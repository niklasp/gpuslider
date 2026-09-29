/**
 * The textures of the media elements, for WebGPU.
 *
 * As for WebGL: images are decoded and scaled off the main thread and
 * uploaded once at the size they are drawn at, with smaller copies of
 * themselves for when they are drawn smaller. Videos are uploaded when they
 * have a new frame, and only while something asks for them.
 *
 * Other than for WebGL, the textures belong to the device, which all
 * sliders of a page share: an image that several sliders show, or a slider
 * and its lightbox, is there once. A texture is freed when the last slider
 * that used it lets go.
 */

const SMALLER = `
struct Point {
	@builtin( position ) at: vec4f,
	@location( 0 ) uv: vec2f,
}
@group( 0 ) @binding( 0 ) var samp: sampler;
@group( 0 ) @binding( 1 ) var image: texture_2d<f32>;
@vertex fn vertex( @builtin( vertex_index ) i: u32 ) -> Point {
	let p = vec2f( f32( ( i << 1 ) & 2 ), f32( i & 2 ) );
	return Point( vec4f( p * 2.0 - 1.0, 0.0, 1.0 ), vec2f( p.x, 1.0 - p.y ) );
}
@fragment fn fragment( point: Point ) -> @location( 0 ) vec4f {
	return textureSample( image, samp, point.uv );
}`;

const FORMAT = 'rgba8unorm';

/**
 * @param {GPUDevice} device  Device.
 * @param {GPUSampler} sampler Sampler that takes the mean of pixels.
 * @return {Object} `get( user, media, width, maxSize )`, `free( user )`.
 */
export function createTextures( device, sampler ) {
	const records = new Map();
	const waiting = new WeakSet();
	let smaller;
	let versions = 0;

	/**
	 * A texture with the pixels of a source.
	 *
	 * @param {Object}  record  Record.
	 * @param {Object}  source  Image, bitmap, canvas or video.
	 * @param {number}  width   Width of the source.
	 * @param {number}  height  Height of the source.
	 * @param {boolean} mipmaps With smaller copies of itself.
	 */
	const upload = ( record, source, width, height, mipmaps ) => {
		const levels = mipmaps
			? Math.floor( Math.log2( Math.max( width, height ) ) ) + 1
			: 1;
		let { texture } = record;
		if ( ! texture || texture.width !== width || texture.height !== height ) {
			texture = device.createTexture( {
				size: [ width, height ],
				format: FORMAT,
				mipLevelCount: levels,
				// 4: TEXTURE_BINDING, 2: COPY_DST, 16: RENDER_ATTACHMENT, which
				// a copy from the page needs too.
				usage: 22,
			} );
		}
		try {
			device.queue.copyExternalImageToTexture(
				{ source },
				{ texture, premultipliedAlpha: true },
				[ width, height ]
			);
		} catch {
			// From another origin without CORS: the page keeps its element.
			record.failed = true;
			texture.destroy();
			return;
		}
		if ( levels > 1 ) {
			smaller ||= device.createRenderPipeline( {
				layout: 'auto',
				vertex: { module: device.createShaderModule( { code: SMALLER } ) },
				fragment: {
					module: device.createShaderModule( { code: SMALLER } ),
					targets: [ { format: FORMAT } ],
				},
			} );
			const encoder = device.createCommandEncoder();
			for ( let level = 1; level < levels; level++ ) {
				const pass = encoder.beginRenderPass( {
					colorAttachments: [
						{
							view: texture.createView( {
								baseMipLevel: level,
								mipLevelCount: 1,
							} ),
							loadOp: 'clear',
							storeOp: 'store',
						},
					],
				} );
				pass.setPipeline( smaller );
				pass.setBindGroup(
					0,
					device.createBindGroup( {
						layout: smaller.getBindGroupLayout( 0 ),
						entries: [
							{ binding: 0, resource: sampler },
							{
								binding: 1,
								resource: texture.createView( {
									baseMipLevel: level - 1,
									mipLevelCount: 1,
								} ),
							},
						],
					} )
				);
				pass.draw( 3 );
				pass.end();
			}
			device.queue.submit( [ encoder.finish() ] );
		}
		if ( record.texture !== texture ) {
			record.texture?.destroy();
			record.texture = texture;
			record.view = texture.createView();
			// Another texture: what was made with the old one is of no use.
			record.version = ++versions;
		}
		record.ready = true;
	};

	const changed = ( record ) => record.users.forEach( ( user ) => user() );

	// Draws a source smaller, for browsers that decode at full size only.
	const shrink = ( source, width, height ) => {
		const canvas = new OffscreenCanvas( width, height );
		canvas.getContext( '2d' ).drawImage( source, 0, 0, width, height );
		return canvas;
	};

	const load = ( record, image, width ) => {
		const height = Math.max(
			1,
			Math.round( ( width * image.naturalHeight ) / image.naturalWidth )
		);
		record.asked = width;
		// Decoded first: WebKit makes an empty bitmap of an image it has
		// loaded but not decoded yet.
		image
			.decode()
			.catch( () => {} )
			.then( () =>
				createImageBitmap( image, {
					resizeWidth: width,
					resizeHeight: height,
					resizeQuality: 'high',
					premultiplyAlpha: 'premultiply',
				} )
			)
			.then( ( bitmap ) => {
				if ( record.users.size ) {
					upload(
						record,
						bitmap.width > width * 1.5
							? shrink( bitmap, width, height )
							: bitmap,
						width,
						height,
						true
					);
				}
				bitmap.close();
			} )
			.catch( () => {
				// What cannot become a bitmap may still be drawn: SVG
				// without a size of its own, for one.
				if ( record.users.size ) {
					upload( record, shrink( image, width, height ), width, height, true );
				}
			} )
			.then( () => changed( record ) );
	};

	const recordOf = ( key, user ) => {
		let record = records.get( key );
		if ( ! record ) {
			record = { key, users: new Set(), asked: 0, version: 0 };
			records.set( key, record );
		}
		record.users.add( user );
		return record;
	};

	const image = ( user, media, width, maxSize ) => {
		const key = media.currentSrc || media.src;
		if ( ! key || ! media.complete || ! media.naturalWidth ) {
			if ( ! waiting.has( media ) ) {
				waiting.add( media );
				media.addEventListener(
					'load',
					() => {
						waiting.delete( media );
						user();
					},
					{ once: true }
				);
			}
			return null;
		}
		const record = recordOf( key, user );
		const limit = Math.min( maxSize, device.limits.maxTextureDimension2D );
		const { naturalWidth: w, naturalHeight: h } = media;
		const want = Math.max(
			1,
			Math.round( Math.min( w, width, limit, ( limit * w ) / h ) )
		);
		// Again only when it is drawn clearly larger than it was loaded.
		if ( ! record.failed && want > record.asked * 1.2 ) {
			load( record, media, want );
		}
		return record.ready ? record : null;
	};

	const video = ( user, media ) => {
		const record = recordOf( media, user );
		record.fresh ??= true;
		if ( record.failed || media.readyState < 2 ) {
			return record.ready ? record : null;
		}
		const frames = 'requestVideoFrameCallback' in media;
		if ( record.fresh || ! frames ) {
			record.fresh = false;
			upload( record, media, media.videoWidth, media.videoHeight, false );
		}
		if ( frames && ! record.armed ) {
			record.armed = true;
			media.requestVideoFrameCallback( () => {
				record.armed = false;
				record.fresh = true;
				changed( record );
			} );
		}
		return record.ready ? record : null;
	};

	return {
		/**
		 * The texture of a media element.
		 *
		 * @param {Function}    user    Who asks: called when the texture has
		 *                              new pixels.
		 * @param {HTMLElement} media   Image or video.
		 * @param {number}      width   Width the whole image is drawn at, in
		 *                              device pixels.
		 * @param {number}      maxSize Largest side of a texture.
		 * @return {Object|null} `view`, `version`; null while there is none.
		 */
		get: ( user, media, width, maxSize ) =>
			media.tagName === 'VIDEO'
				? video( user, media )
				: image( user, media, width, maxSize ),

		/**
		 * @param {Function} user Who no longer draws.
		 */
		free( user ) {
			records.forEach( ( record, key ) => {
				if ( record.users.delete( user ) && ! record.users.size ) {
					record.texture?.destroy();
					records.delete( key );
				}
			} );
		},
	};
}
