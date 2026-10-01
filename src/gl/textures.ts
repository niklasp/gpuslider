/**
 * The textures of the media elements.
 *
 * Images are decoded and scaled off the main thread, uploaded once at the
 * size they are drawn at, with mipmaps. Slides that show the same file
 * share one texture.
 *
 * Videos are uploaded when they have a new frame, and only while something
 * asks for them.
 */

import { empty } from './fit.js';

/** The texture of a media element, and what is known of it. */
export interface Texture {
	texture: WebGLTexture;
	ready: boolean;
	failed: boolean;
	/** Width it was uploaded at, px. */
	width: number;
	/** Width it was asked for at last, px. */
	asked: number;
	/** How often the picture came empty. */
	tries?: number;
	/** A video has a frame that is not uploaded yet. */
	fresh?: boolean;
	/** A video waits for its next frame. */
	armed?: boolean;
}

type Image = HTMLImageElement;
type Video = HTMLVideoElement;

/**
 * @param gl Context.
 * @param options Options.
 * @param options.maxSize Largest side of a texture.
 * @param options.changed Called when a texture has
 *                        new pixels.
 * @return `get( media, width )`, `destroy()`.
 */
export function createTextures( gl: WebGL2RenderingContext, { maxSize, changed }: { maxSize: number; changed: () => void } ) {
	const limit = Math.min( maxSize, gl.getParameter( gl.MAX_TEXTURE_SIZE ) );
	const records = new Map< string | Video, Texture >();
	const waiting = new Set< Image >();
	let destroyed = false;

	const create = ( mipmaps: boolean ): Texture => {
		const texture = gl.createTexture()!;
		gl.bindTexture( gl.TEXTURE_2D, texture );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_MIN_FILTER,
			mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR
		);
		return { texture, ready: false, failed: false, width: 0, asked: 0 };
	};

	const upload = ( record: Texture, source: TexImageSource, mipmaps: boolean ) => {
		gl.bindTexture( gl.TEXTURE_2D, record.texture );
		gl.pixelStorei( gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true );
		try {
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				source
			);
		} catch {
			// From another origin without CORS: the page keeps its element.
			record.failed = true;
			return;
		}
		if ( mipmaps ) {
			gl.generateMipmap( gl.TEXTURE_2D );
		}
		record.ready = true;
	};

	// Draws a source smaller, for browsers that decode at full size only.
	const shrink = ( source: CanvasImageSource, width: number, height: number ) => {
		const canvas = new OffscreenCanvas( width, height );
		canvas.getContext( '2d' )!.drawImage( source, 0, 0, width, height );
		return canvas;
	};

	const load = ( record: Texture, image: Image, width: number ) => {
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
				// Nothing in it: the page goes on drawing the image, and
				// it is asked for again, ten times at most.
				record.tries = ( record.tries || 0 ) + 1;
				if ( record.tries < 10 && empty( shrink( bitmap, 4, 4 ) ) ) {
					setTimeout( () => {
						record.asked = 0;
						if ( ! destroyed ) {
							changed();
						}
					}, 200 );
				} else if ( ! destroyed ) {
					upload(
						record,
						bitmap.width > width * 1.5
							? shrink( bitmap, width, height )
							: bitmap,
						true
					);
				}
				bitmap.close();
			} )
			.catch( () => {
				// What cannot become a bitmap may still be drawn: SVG
				// without a size of its own, for one.
				if ( ! destroyed ) {
					upload( record, image, true );
				}
			} )
			.then( () => {
				if ( ! destroyed ) {
					record.width = width;
					changed();
				}
			} );
	};

	const image = ( media: Image, width: number ) => {
		const key = media.currentSrc || media.src;
		if ( ! key || ! media.complete || ! media.naturalWidth ) {
			if ( ! waiting.has( media ) ) {
				waiting.add( media );
				media.addEventListener(
					'load',
					() => {
						waiting.delete( media );
						changed();
					},
					{ once: true }
				);
			}
			return null;
		}
		let record = records.get( key );
		if ( ! record ) {
			record = create( true );
			records.set( key, record );
		}
		const { naturalWidth: w, naturalHeight: h } = media;
		// Not at most its natural width: of an image of a `srcset` that is
		// the width of its CSS pixels, not of the file.
		const want = Math.max(
			1,
			Math.round( Math.min( width, limit, ( limit * w ) / h ) )
		);
		// Again only when it is drawn clearly larger than it was loaded.
		if ( ! record.failed && want > record.asked * 1.2 ) {
			load( record, media, want );
		}
		return record.ready ? record : null;
	};

	const video = ( media: Video ) => {
		let record = records.get( media );
		if ( ! record ) {
			record = create( false );
			record.fresh = true;
			records.set( media, record );
		}
		if ( record.failed || media.readyState < 2 ) {
			return record.ready ? record : null;
		}
		const frames = 'requestVideoFrameCallback' in media;
		if ( record.fresh || ! frames ) {
			record.fresh = false;
			upload( record, media, false );
		}
		if ( frames && ! record.armed ) {
			record.armed = true;
			media.requestVideoFrameCallback( () => {
				record.armed = false;
				record.fresh = true;
				if ( ! destroyed ) {
					changed();
				}
			} );
		}
		return record.ready ? record : null;
	};

	return {
		/**
		 * The texture of a media element.
		 *
		 * @param media Image or video.
		 * @param width Width the whole image is drawn at, in
		 *              device pixels.
		 * @return `texture`; null while there is none.
		 */
		get: ( media: HTMLElement, width: number ): Texture | null =>
			media.tagName === 'VIDEO' ? video( media as Video ) : image( media as Image, width ),

		destroy() {
			destroyed = true;
			records.forEach( ( { texture } ) => gl.deleteTexture( texture ) );
			records.clear();
		},
	};
}
