/**
 * The canvas layer: draws the media of the slides with WebGPU.
 *
 * It does what the WebGL layer does, with the same effects, and is used
 * the same way. See `../gl/layer.js` for what a layer is to a slider.
 *
 * What is different: all sliders of a page share one device, so there is
 * no limit to how many of them draw, a shader is compiled once for all of
 * them, and an image that several of them show is on the graphics card
 * once.
 *
 * Without WebGPU, or after the device is lost, the layer does nothing and
 * the page shows its own media.
 */
import { compose } from './program.js';
import { createTextures } from './textures.js';
import { fit, styleOf } from '../gl/fit.js';

// Squares per side of a quad that bends.
const MESH = 32;

// How fast the pointer of the shader follows the real one, per second.
const FOLLOW = 8;

// Samples per pixel, for the edges of quads that bend.
const SAMPLES = 4;

// A quad is told its numbers at a place in a buffer that is a multiple of
// this, bytes.
const STEP = 256;

const FADE =
	'vec4 transition( vec2 uv ) { return mix( getFromColor( uv ), getToColor( uv ), progress ); }';

// The device of a page, with what its sliders share, by window.
const devices = new WeakMap();

/**
 * @param {Window} win Window.
 * @return {Promise<Object|null>} The device and what belongs to it; null
 *                                without WebGPU.
 */
function deviceOf( win ) {
	if ( ! devices.has( win ) ) {
		devices.set(
			win,
			( async () => {
				const adapter = await win.navigator.gpu?.requestAdapter();
				const device = await adapter?.requestDevice();
				if ( ! device ) {
					return null;
				}
				device.lost.then( () => devices.delete( win ) );
				device.addEventListener( 'uncapturederror', ( { error } ) =>
					// eslint-disable-next-line no-console
					console.error( 'shaderslide:', error.message )
				);
				const sampler = device.createSampler( {
					magFilter: 'linear',
					minFilter: 'linear',
					mipmapFilter: 'linear',
				} );
				// 1: for the vertex shader, 2: for the fragment shader.
				const told = device.createBindGroupLayout( {
					entries: [
						{
							binding: 0,
							visibility: 3,
							buffer: { hasDynamicOffset: true },
						},
					],
				} );
				const shown = device.createBindGroupLayout( {
					entries: [
						{ binding: 0, visibility: 2, sampler: {} },
						{ binding: 1, visibility: 2, texture: {} },
						{ binding: 2, visibility: 2, texture: {} },
					],
				} );
				// For slides without media, and for media that is not there
				// yet.
				const nothing = {
					version: 0,
					view: device
						.createTexture( {
							size: [ 1, 1 ],
							format: 'rgba8unorm',
							usage: 4,
						} )
						.createView(),
				};
				return {
					device,
					sampler,
					told,
					shown,
					nothing,
					format: win.navigator.gpu.getPreferredCanvasFormat(),
					layout: device.createPipelineLayout( {
						bindGroupLayouts: [ told, shown ],
					} ),
					textures: createTextures( device, sampler ),
					pipelines: new Map(),
					meshes: new Map(),
				};
			} )().catch( () => null )
		);
	}
	return devices.get( win );
}

/**
 * One grid for every quad: 0 to 1 from the top left.
 *
 * @param {Object} shared What the sliders of a page share.
 * @param {number} n      Squares per side.
 * @return {Object} `points` and `order` (buffers), `indices` (how many).
 */
function meshOf( { device, meshes }, n ) {
	if ( ! meshes.has( n ) ) {
		const points = [];
		const order = [];
		for ( let y = 0; y <= n; y++ ) {
			for ( let x = 0; x <= n; x++ ) {
				points.push( x / n, y / n );
				if ( x < n && y < n ) {
					const i = y * ( n + 1 ) + x;
					order.push( i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2 );
				}
			}
		}
		const buffer = ( data, usage ) => {
			const made = device.createBuffer( {
				size: Math.ceil( data.byteLength / 4 ) * 4,
				// 8: COPY_DST.
				usage: usage | 8,
			} );
			device.queue.writeBuffer( made, 0, data );
			return made;
		};
		meshes.set( n, {
			// 32: VERTEX, 16: INDEX.
			points: buffer( new Float32Array( points ), 32 ),
			order: buffer( new Uint16Array( order ), 16 ),
			indices: order.length,
		} );
	}
	return meshes.get( n );
}

/**
 * @param {Object}   [options]             Options.
 * @param {import('../gl/program.js').Effect[]} [options.effects] Effects,
 *                                         in the order they apply.
 * @param {number}   [options.maxSize]     Largest side of a texture, px.
 * @param {number}   [options.density]     Most device pixels per px drawn.
 * @param {number}   [options.perspective] Distance of the eye for meshes
 *                                         that bend, px.
 * @param {boolean}  [options.eager]       Make the canvas with the slider,
 *                                         not at the first sign of use.
 * @param {boolean}  [options.preserve]    Keep a copy of every frame as
 *                                         `picture`, for tests: what
 *                                         WebGPU has drawn is gone when it
 *                                         is on the screen.
 */
export function gpu( {
	effects = [],
	maxSize = 2048,
	density = 2,
	perspective = 1200,
	eager = false,
	preserve = false,
} = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, slides, win } = slider;
		const doc = root.ownerDocument;
		// Made with the first layout: by then every plugin of the slider is
		// there.
		let stack;
		let shader;
		// Per slide: its media, the box of the media in its slide with
		// what CSS says, and the numbers of `fit()`.
		const media = [];
		const boxes = [];
		const numbers = [];
		const read = () => {
			slides.forEach( ( slide, i ) => {
				media[ i ] = slide.querySelector( '.ss-media' );
				boxes[ i ] = null;
				numbers[ i ] ||= new Float32Array( 13 );
			} );
			media.length = slides.length;
			boxes.length = slides.length;
		};
		read();
		// The quad about to be drawn, for whoever changes it (see `change`).
		const next = { x: 0, y: 0, w: 0, h: 0, a: null, radius: 0, speed: 0 };

		let context = null;
		// Whether the device, or the compiler, is asked for.
		let making = false;
		let near = false;
		let wanted = eager;
		let destroyed = false;
		let width = 0;
		let height = 0;
		let ratio = 0;
		const pointer = {
			x: 0,
			y: 0,
			in: 0,
			tx: 0,
			ty: 0,
			tin: 0,
			vx: 0,
			vy: 0,
			moving: false,
		};
		const drawn = new Set();
		const listening = { passive: true, signal: slider.signal };

		const show = ( element, on ) => {
			if ( on !== drawn.has( element ) ) {
				element.classList.toggle( 'ss-drawn', on );
				drawn[ on ? 'add' : 'delete' ]( element );
			}
		};

		async function attach() {
			if (
				context ||
				making ||
				destroyed ||
				! near ||
				! wanted ||
				! shader
			) {
				return;
			}
			making = true;
			const shared = await deviceOf( win );
			let pipeline;
			if ( shared ) {
				const { device, pipelines, format, layout } = shared;
				const key = shader.code + shader.mesh;
				if ( ! pipelines.has( key ) ) {
					const module = device.createShaderModule( {
						code: shader.code,
					} );
					pipelines.set(
						key,
						// The compiler has its own thread.
						device.createRenderPipelineAsync( {
							layout,
							vertex: {
								module,
								buffers: [
									{
										arrayStride: 8,
										attributes: [
											{
												shaderLocation: 0,
												offset: 0,
												format: 'float32x2',
											},
										],
									},
								],
							},
							fragment: {
								module,
								targets: [
									{
										format,
										blend: {
											color: {
												srcFactor: 'one',
												dstFactor: 'one-minus-src-alpha',
											},
											alpha: {
												srcFactor: 'one',
												dstFactor: 'one-minus-src-alpha',
											},
										},
									},
								],
							},
							...( shader.mesh && {
								depthStencil: {
									format: 'depth24plus',
									depthWriteEnabled: true,
									depthCompare: 'less-equal',
								},
								multisample: { count: SAMPLES },
							} ),
						} )
					);
				}
				pipeline = await pipelines.get( key ).catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'shaderslide:', error.message );
					destroyed = true;
				} );
			}
			making = false;
			// Meanwhile the slider may have left the screen, or the page.
			if ( ! pipeline || destroyed || ! near ) {
				return;
			}
			const { device, format } = shared;
			const canvas = doc.createElement( 'canvas' );
			canvas.className = 'ss-canvas';
			canvas.setAttribute( 'aria-hidden', 'true' );
			const surface = canvas.getContext( 'webgpu' );
			surface.configure( { device, format, alphaMode: 'premultiplied' } );

			context = {
				shared,
				canvas,
				surface,
				pipeline,
				mesh: meshOf( shared, shader.mesh ? MESH : 1 ),
				// What the quads of a frame are told, and how many quads
				// there is room for.
				data: new Float32Array( 0 ),
				room: 0,
				groups: new Map(),
			};
			device.lost.then( () => {
				if ( context?.shared === shared ) {
					detach( true );
				}
			} );
			width = 0;
			root.prepend( canvas );
			root.classList.add( 'ss-gl' );
			slider.wake();
			slider.emit( 'gpu:on', canvas );
		}

		function detach( lost ) {
			if ( ! context ) {
				return;
			}
			const { shared, canvas, surface, buffer, targets } = context;
			context = null;
			drawn.forEach( ( element ) => show( element, false ) );
			root.classList.remove( 'ss-gl' );
			slider.emit( 'gpu:off', !! lost );
			canvas.remove();
			shared.textures.free( slider.wake );
			if ( lost ) {
				// A new device at the next sign of use.
				wanted = false;
				hear();
			} else {
				surface.unconfigure();
				buffer?.destroy();
				targets?.forEach( ( target ) => target.destroy() );
			}
		}

		const observer = new win.IntersectionObserver(
			( entries ) => {
				near = entries[ entries.length - 1 ].isIntersecting;
				if ( near ) {
					attach();
				} else {
					detach();
				}
			},
			{ rootMargin: '25%' }
		);
		observer.observe( root );

		const move = ( event ) => {
			const box = root.getBoundingClientRect();
			pointer.tx = event.clientX - box.left - root.clientLeft;
			pointer.ty = event.clientY - box.top - root.clientTop;
			pointer.tin = 1;
			// It comes in where it is, not from where it left.
			if ( pointer.in < 0.01 ) {
				pointer.x = pointer.tx;
				pointer.y = pointer.ty;
			}
			pointer.moving = true;
			slider.wake();
		};
		const leave = ( event ) => {
			if ( event.type === 'pointerleave' || event.pointerType !== 'mouse' ) {
				pointer.tin = 0;
				pointer.moving = true;
				slider.wake();
			}
		};
		// The first sign of use.
		const want = () => {
			wanted = true;
			attach();
		};
		const hear = () =>
			[ 'pointerenter', 'pointerdown', 'focusin' ].forEach( ( name ) =>
				root.addEventListener( name, want, { ...listening, once: true } )
			);
		hear();

		/**
		 * The media of a slide as a texture, and where its pixels are in
		 * the quad.
		 *
		 * @param {number} i  Slide, or -1 for none.
		 * @param {number} x  The slide in the quad, px.
		 * @param {number} y  The slide in the quad, px.
		 * @param {number} qw Width of the quad.
		 * @param {number} qh Height of the quad.
		 * @return {Object|null} `record` of the texture and `numbers` of
		 *                       `fit()`; null when the canvas has nothing
		 *                       to draw.
		 */
		const bind = ( i, x, y, qw, qh ) => {
			const { textures } = context.shared;
			const element = media[ i ];
			const box = boxes[ i ];
			if ( ! element || ! box || ! box.at.w || ! box.at.h ) {
				return null;
			}
			const iw = element.naturalWidth || element.videoWidth;
			const ih = element.naturalHeight || element.videoHeight;
			if ( ! iw || ! ih ) {
				// Asks for it, so that the layer hears when it is there.
				textures.get( slider.wake, element, 0, maxSize );
				return null;
			}
			const out = numbers[ i ];
			box.at.x = x;
			box.at.y = y;
			const shown = fit( iw, ih, box.at, qw, qh, box.style, out );
			const record = textures.get(
				slider.wake,
				element,
				shown * ratio,
				maxSize
			);
			show( element, !! record );
			return record ? { record, numbers: out } : null;
		};

		const layer = {
			name: 'gpu',

			/** The canvas, while the layer draws. */
			get canvas() {
				return context?.canvas || null;
			},

			/** With `preserve`: a canvas with the frame that was drawn last. */
			get picture() {
				return context?.picture || null;
			},

			/**
			 * Called with every slide of a row before it is drawn, with its
			 * index and its quad: `x`, `y`, `w`, `h` in px of the canvas,
			 * `a` (numbers of `fit()`), `radius` and `speed`, which is
			 * added to the speed of the slider. What it changes is drawn.
			 */
			change: null,

			/**
			 * @param {HTMLElement} element Media element.
			 * @return {boolean} Whether the canvas draws it.
			 */
			shows: ( element ) => drawn.has( element ),

			slides: read,

			measure() {
				if ( ! shader ) {
					stack = slider.layout().stack;
					shader = compose(
						effects,
						stack ? FADE : null,
						slider.layout().y
					);
					if ( shader.pointer ) {
						[ 'pointerdown', 'pointermove' ].forEach( ( name ) =>
							root.addEventListener( name, move, listening )
						);
						[ 'pointerleave', 'pointerup', 'pointercancel' ].forEach(
							( name ) =>
								root.addEventListener( name, leave, listening )
						);
					}
					// What moves by itself needs its canvas before it does,
					// and what looks different at rest should not wait for
					// somebody to come.
					if (
						shader.animated ||
						shader.placed ||
						slider.plugins.autoplay ||
						slider.plugins.marquee
					) {
						( win.requestIdleCallback || win.setTimeout )( want );
					}
					attach();
				}
				const around = root.getBoundingClientRect();
				const scale = root.offsetWidth
					? around.width / root.offsetWidth || 1
					: 1;
				const down = slider.layout().y;
				slides.forEach( ( slide, i ) => {
					const element = media[ i ];
					if ( ! element ) {
						return;
					}
					const outer = slide.getBoundingClientRect();
					const inner = element.getBoundingClientRect();
					const x = inner.left - ( down ? around : outer ).left;
					const y = inner.top - ( down ? outer : around ).top;
					boxes[ i ] = {
						// Along the way of the slides, in the slide: the slide
						// moves, this does not.
						dx: ( down ? y : x ) / scale,
						// Across, in the view: that way slides do not move.
						dy:
							( down ? x : y ) / scale -
							( down ? root.clientLeft : root.clientTop ),
						at: { x: 0, y: 0, w: inner.width / scale, h: inner.height / scale },
						style: styleOf( element ),
					};
				} );
			},

			frame( view, dt, now ) {
				const { layout, places, motion } = view;
				if ( ! context ) {
					if ( motion.dragging || motion.pos !== motion.target ) {
						want();
					}
					return;
				}
				const { shared, canvas, surface, pipeline, mesh, groups } = context;
				const { device, told, shown, sampler, nothing } = shared;
				const to = Math.min( density, win.devicePixelRatio || 1 );
				// As high as the view gets: with auto height the view
				// changes on every frame, the canvas does not.
				const high = slider.plugins.autoHeight?.most || layout.height;
				if ( layout.width !== width || high !== height || to !== ratio ) {
					width = layout.width;
					height = high;
					ratio = to;
					canvas.style.height = `${ height }px`;
					const most = device.limits.maxTextureDimension2D;
					canvas.width = Math.min(
						most,
						Math.max( 1, Math.round( width * ratio ) )
					);
					canvas.height = Math.min(
						most,
						Math.max( 1, Math.round( height * ratio ) )
					);
					context.targets?.forEach( ( target ) => target.destroy() );
					// What bends is drawn with a depth, and with several
					// samples per pixel for its edges.
					context.targets = shader.mesh
						? [ shared.format, 'depth24plus' ].map( ( format ) =>
								device.createTexture( {
									size: [ canvas.width, canvas.height ],
									sampleCount: SAMPLES,
									format,
									// 16: RENDER_ATTACHMENT.
									usage: 16,
								} )
						  )
						: null;
				}

				const follow = 1 - Math.exp( -FOLLOW * dt );
				const { x: wasX, y: wasY } = pointer;
				pointer.x += ( pointer.tx - pointer.x ) * follow;
				pointer.y += ( pointer.ty - pointer.y ) * follow;
				pointer.in += ( pointer.tin - pointer.in ) * follow;
				pointer.vx = ( pointer.x - wasX ) / dt;
				pointer.vy = ( pointer.y - wasY ) / dt;
				pointer.moving =
					Math.abs( pointer.tx - pointer.x ) > 0.1 ||
					Math.abs( pointer.ty - pointer.y ) > 0.1 ||
					Math.abs( pointer.tin - pointer.in ) > 0.002;
				if ( ! pointer.moving ) {
					pointer.in = pointer.tin;
					pointer.vx = 0;
					pointer.vy = 0;
				}

				// Effects have the way of the slides as their x.
				const down = layout.y;
				// To the right on the screen, whatever the reading direction.
				const velocity = ( layout.rtl ? 1 : -1 ) * view.velocity;
				const { at, numbers: each } = shader;
				// Numbers from one quad to the next: the places in the
				// buffer are apart by a multiple of STEP bytes.
				const step = Math.ceil( ( each * 4 ) / STEP ) * ( STEP / 4 );
				const quads = [];

				const quad = ( x, y, w, h, a, b, progress, mix, radius, speed ) => {
					const from = quads.length * step;
					if ( quads.length >= context.room ) {
						context.room = 2 * context.room || 8;
						const more = new Float32Array( context.room * step );
						more.set( context.data );
						context.data = more;
						context.buffer?.destroy();
						context.buffer = null;
					}
					const { data } = context;
					const two = ( name, u, v ) => {
						data[ from + at[ name ] ] = down ? v : u;
						data[ from + at[ name ] + 1 ] = down ? u : v;
					};
					const one = ( name, value ) => {
						data[ from + at[ name ] ] = value;
					};
					two( 'uQuad', x, y );
					two( 'uSize', w, h );
					data[ from + at.uQuad + 2 ] = down ? h : w;
					data[ from + at.uQuad + 3 ] = down ? w : h;
					two( 'uView', width, height );
					two( 'uPointer', ( pointer.x - x ) / w, ( pointer.y - y ) / h );
					two( 'uPointerSpeed', pointer.vx / w, pointer.vy / h );
					one( 'uTime', now / 1000 );
					one( 'uPointerIn', pointer.in );
					one( 'uDepth', perspective );
					one( 'uVelocity', velocity + speed );
					one( 'uProgress', progress );
					one( 'uMix', mix );
					one( 'uRadius', radius );
					data.set( a.numbers.subarray( 0, 4 ), from + at.uBoxA );
					data.set( a.numbers.subarray( 4, 8 ), from + at.uRectA );
					data.set( b.numbers.subarray( 0, 4 ), from + at.uBoxB );
					data.set( b.numbers.subarray( 4, 8 ), from + at.uRectB );
					data[ from + at.uCut ] = a.numbers[ 8 ];
					data[ from + at.uCut + 1 ] = b.numbers[ 8 ];
					for ( const name in shader.params ) {
						data.set( shader.params[ name ], from + at[ name ] );
					}
					quads.push( [ a.record, b.record ] );
				};

				if ( stack ) {
					// The slide the position has passed, and the one it
					// moves to.
					let from = -1;
					let upcoming = -1;
					let mix = 0;
					places.forEach( ( { p }, i ) => {
						if ( p <= 0 && p > -1 ) {
							from = i;
							mix = -p;
						} else if ( p > 0 && p < 1 ) {
							upcoming = i;
						}
					} );
					const [ a, b ] = [ from, upcoming ].map( ( i ) => {
						const x = boxes[ i ]?.dx || 0;
						const y = boxes[ i ]?.dy || 0;
						return down
							? bind( i, y, x, width, height )
							: bind( i, x, y, width, height );
					} );
					if ( a || b ) {
						quad( 0, 0, width, height, a || EMPTY, b || EMPTY, mix, mix, 0, 0 );
					}
				} else {
					const { span, size, rtl } = layout;
					places.forEach( ( place, i ) => {
						const box = boxes[ i ];
						// A view further on each side: what bends may reach
						// in.
						if (
							! box ||
							place.x + size[ i ] < -span ||
							place.x > 2 * span
						) {
							return;
						}
						const along =
							( rtl ? span - place.x - size[ i ] : place.x ) + box.dx;
						const bound = bind( i, 0, 0, box.at.w, box.at.h );
						if ( bound ) {
							next.a = bound.numbers;
							next.x = down ? box.dy : along;
							next.y = down ? along : box.dy;
							next.w = box.at.w;
							next.h = box.at.h;
							next.radius = box.style.radius;
							next.speed = 0;
							layer.change?.( i, next );
							quad(
								next.x,
								next.y,
								next.w,
								next.h,
								{ record: bound.record, numbers: next.a },
								EMPTY,
								place.p,
								0,
								next.radius,
								next.speed
							);
						}
					} );
				}

				// 64: UNIFORM, 8: COPY_DST.
				if ( ! context.buffer ) {
					context.buffer = device.createBuffer( {
						size: context.room * step * 4 || STEP,
						usage: 72,
					} );
					context.group = device.createBindGroup( {
						layout: told,
						entries: [
							{
								binding: 0,
								resource: {
									buffer: context.buffer,
									size: Math.max( each * 4, 16 ),
								},
							},
						],
					} );
				}
				device.queue.writeBuffer(
					context.buffer,
					0,
					context.data,
					0,
					quads.length * step
				);

				const encoder = device.createCommandEncoder();
				const screen = surface.getCurrentTexture().createView();
				const [ colour, depth ] = context.targets || [];
				const pass = encoder.beginRenderPass( {
					colorAttachments: [
						{
							view: colour ? colour.createView() : screen,
							resolveTarget: colour && screen,
							clearValue: [ 0, 0, 0, 0 ],
							loadOp: 'clear',
							storeOp: colour ? 'discard' : 'store',
						},
					],
					...( depth && {
						depthStencilAttachment: {
							view: depth.createView(),
							depthClearValue: 1,
							depthLoadOp: 'clear',
							depthStoreOp: 'discard',
						},
					} ),
				} );
				pass.setPipeline( pipeline );
				pass.setVertexBuffer( 0, mesh.points );
				pass.setIndexBuffer( mesh.order, 'uint16' );
				// Groups of textures that were not used for a while are
				// made again when they are: there are few.
				if ( groups.size > 64 ) {
					groups.clear();
				}
				quads.forEach( ( [ a, b ], i ) => {
					const pair = [ a || nothing, b || nothing ];
					const key = pair.map( ( { version } ) => version ).join();
					if ( ! groups.has( key ) ) {
						groups.set(
							key,
							device.createBindGroup( {
								layout: shown,
								entries: [
									{ binding: 0, resource: sampler },
									{ binding: 1, resource: pair[ 0 ].view },
									{ binding: 2, resource: pair[ 1 ].view },
								],
							} )
						);
					}
					pass.setBindGroup( 0, context.group, [ i * step * 4 ] );
					pass.setBindGroup( 1, groups.get( key ) );
					pass.drawIndexed( mesh.indices );
				} );
				pass.end();
				device.queue.submit( [ encoder.finish() ] );
				if ( preserve ) {
					context.picture = new OffscreenCanvas(
						canvas.width,
						canvas.height
					);
					context.picture.getContext( '2d' ).drawImage( canvas, 0, 0 );
				}
			},

			busy: () =>
				making ||
				( !! context &&
					( pointer.moving ||
						shader.animated ||
						( shader.hover && pointer.tin > 0 ) ||
						media.some(
							( element, i ) =>
								element?.tagName === 'VIDEO' &&
								! element.paused &&
								slider.view.places[ i ].visible &&
								! ( 'requestVideoFrameCallback' in element )
						) ) ),

			destroy() {
				destroyed = true;
				observer.disconnect();
				detach();
			},
		};
		return layer;
	};
}

const EMPTY = {
	record: null,
	numbers: new Float32Array( [ 1, 1, 0, 0, 0, 0, 0, 0, 0 ] ),
};
