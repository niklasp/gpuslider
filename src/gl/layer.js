/**
 * The canvas layer: draws the media of the slides with WebGL 2.
 *
 * The page keeps everything else. The media elements stay where they are
 * and become transparent once the canvas shows them; slide content lies
 * above the canvas. Without WebGL 2, without a free context or after a
 * lost one, the layer does nothing and the page shows its own media.
 *
 * A slider at rest looks the same with and without the canvas, so the
 * canvas waits for the first sign of use: a pointer that comes, the focus,
 * a move. Until then the page pays nothing for it, neither while it loads
 * nor in memory. What moves by itself (autoplay, an effect that is
 * animated) has its canvas made when the browser is idle.
 *
 * Nothing here reads the layout while the slider moves: the boxes of the
 * media are measured with the layout, the rest is arithmetic.
 */
import { compose, build, ready } from './program.js';
import { createTextures } from './textures.js';
import { fit, nearby, styleOf } from './fit.js';

// Contexts in use. Browsers drop the oldest beyond about 16 per page.
const MAX_LIVE = 12;
let live = 0;

// Canvases of sliders that went off screen, with their context, by
// document: a context is only freed when the browser collects it, so
// creating new ones for sliders that come and go would still hit the limit.
const spares = new WeakMap();

// Spares are contexts too, so there are only a few.
const MAX_SPARE = 3;

// Squares per side of a quad that bends.
const MESH = 32;

// How fast the pointer of the shader follows the real one, per second.
const FOLLOW = 8;

const FADE =
	'vec4 transition( vec2 uv ) { return mix( getFromColor( uv ), getToColor( uv ), progress ); }';

/**
 * @param {Object}   [options]             Options.
 * @param {import('./program.js').Effect[]} [options.effects] Effects, in
 *                                         the order they apply.
 * @param {number}   [options.maxSize]     Largest side of a texture, px.
 * @param {number}   [options.density]     Most device pixels per px drawn.
 * @param {number}   [options.perspective] Distance of the eye for meshes
 *                                         that bend, px.
 * @param {boolean}  [options.eager]       Make the canvas with the slider,
 *                                         not at the first sign of use.
 * @param {boolean}  [options.preserve]    Keep the drawing readable, for
 *                                         tests and screenshots.
 * @param {Set<Function>} [options.hooks]  Functions that are called with
 *                                         every quad before it is drawn,
 *                                         before `change`: a set that the
 *                                         page may fill and empty while the
 *                                         layer draws. `canvas()` has
 *                                         `draw()` for it.
 */
export function gl( {
	effects = [],
	maxSize = 2048,
	density = 2,
	perspective = 1200,
	eager = false,
	preserve = false,
	hooks = new Set(),
} = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, slides, win } = slider;
		const doc = root.ownerDocument;
		// Made with the first layout: by then every plugin of the slider is
		// there.
		let stack;
		let shader;
		let kind;
		// Per slide: its media, the box of the media in its slide with
		// what CSS says, and the numbers of `fit()`.
		const media = [];
		const boxes = [];
		const numbers = [];
		const read = () => {
			slides.forEach( ( slide, i ) => {
				media[ i ] = slide.querySelector( '.gs-media' );
				boxes[ i ] = null;
				numbers[ i ] ||= new Float32Array( 13 );
			} );
			media.length = slides.length;
			boxes.length = slides.length;
		};
		read();
		// The quad about to be drawn, for whoever changes it (see `change`).
		const next = { x: 0, y: 0, w: 0, h: 0, a: null, radius: 0, speed: 0 };
		// Where the canvas is, when it is lifted out of the slider (see
		// `lift`): the view in it, and its size.
		let lifted = null;
		const frame = [ 0, 0, 0, 0 ];

		let context = null;
		// A canvas whose shader the compiler still has.
		let making = null;
		let near = false;
		// A hook given before the layer is there is a use of it.
		let wanted = eager || hooks.size;
		let destroyed = false;
		let retry = 0;
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
				element.classList.toggle( 'gs-drawn', on );
				drawn[ on ? 'add' : 'delete' ]( element );
			}
		};

		function attach() {
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
			const pool = spares.get( doc ) || [];
			spares.set( doc, pool );
			let spare;
			for ( let i = pool.length - 1; i >= 0 && ! spare; i-- ) {
				if ( pool[ i ].gl.isContextLost() ) {
					pool.splice( i, 1 );
				} else if ( pool[ i ].kind === kind ) {
					[ spare ] = pool.splice( i, 1 );
				}
			}
			if ( ! spare ) {
				// The page draws, until the slider is used again.
				if ( live >= MAX_LIVE ) {
					return;
				}
				const canvas = doc.createElement( 'canvas' );
				const made = canvas.getContext( 'webgl2', {
					antialias: shader.mesh,
					depth: shader.mesh,
					preserveDrawingBuffer: preserve,
				} );
				if ( ! made ) {
					return;
				}
				canvas.className = 'gs-canvas';
				canvas.setAttribute( 'aria-hidden', 'true' );
				spare = { canvas, gl: made, kind, programs: new Map() };
				canvas.addEventListener( 'webglcontextlost', ( event ) => {
					event.preventDefault();
					spare.lost?.();
				} );
			}
			live++;
			const key = shader.fragment + shader.vertex;
			making = {
				spare,
				key,
				program:
					spare.programs.get( key ) ||
					build( spare.gl, shader.vertex, shader.fragment ),
			};
			slider.wake();
		}

		// The compiler is done: the canvas takes over.
		function begin() {
			const { spare, program, key } = making;
			const { canvas, programs } = spare;
			const g = spare.gl;
			try {
				if ( ! ready( g, program ) ) {
					return;
				}
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( 'gpuslider:', error );
				making = null;
				live--;
				spares.get( doc ).push( spare );
				destroyed = true;
				return;
			}
			making = null;
			programs.set( key, program );
			g.useProgram( program );

			// One grid for every quad: 0 to 1 from the top left.
			const n = shader.mesh ? MESH : 1;
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
			const mesh = g.createVertexArray();
			g.bindVertexArray( mesh );
			const buffers = [ g.createBuffer(), g.createBuffer() ];
			g.bindBuffer( g.ARRAY_BUFFER, buffers[ 0 ] );
			g.bufferData( g.ARRAY_BUFFER, new Float32Array( points ), g.STATIC_DRAW );
			g.enableVertexAttribArray( 0 );
			g.vertexAttribPointer( 0, 2, g.FLOAT, false, 0, 0 );
			g.bindBuffer( g.ELEMENT_ARRAY_BUFFER, buffers[ 1 ] );
			g.bufferData(
				g.ELEMENT_ARRAY_BUFFER,
				new Uint16Array( order ),
				g.STATIC_DRAW
			);

			const at = {};
			const count = g.getProgramParameter( program, g.ACTIVE_UNIFORMS );
			for ( let i = 0; i < count; i++ ) {
				const { name } = g.getActiveUniform( program, i );
				at[ name ] = g.getUniformLocation( program, name );
			}
			g.uniform1i( at.uA, 0 );
			g.uniform1i( at.uB, 1 );
			g.uniform1f( at.uDepth, perspective );

			g.enable( g.BLEND );
			g.blendFunc( g.ONE, g.ONE_MINUS_SRC_ALPHA );
			g[ shader.mesh ? 'enable' : 'disable' ]( g.DEPTH_TEST );
			g.depthFunc( g.LEQUAL );
			g.clearColor( 0, 0, 0, 0 );

			// For slides without media, and for media that is not there yet.
			const nothing = g.createTexture();
			g.bindTexture( g.TEXTURE_2D, nothing );
			g.texImage2D(
				g.TEXTURE_2D,
				0,
				g.RGBA,
				1,
				1,
				0,
				g.RGBA,
				g.UNSIGNED_BYTE,
				new Uint8Array( 4 )
			);

			context = {
				spare,
				g,
				at,
				mesh,
				buffers,
				nothing,
				indices: order.length,
				textures: createTextures( g, {
					maxSize,
					changed: slider.wake,
				} ),
			};
			spare.lost = () => {
				detach( true );
				// The browser may give the context back; a new one does too.
				retry = win.setTimeout( attach, 1000 );
			};
			width = 0;
			root.prepend( canvas );
			root.classList.add( 'gs-gl' );
			slider.wake();
			slider.emit( 'gl:on', canvas );
			ahead();
		}

		function detach( lost ) {
			if ( making ) {
				live--;
				spares.get( doc ).push( making.spare );
				making = null;
			}
			if ( ! context ) {
				return;
			}
			const { spare, g, mesh, buffers, nothing, textures } = context;
			context = null;
			live--;
			drawn.forEach( ( element ) => show( element, false ) );
			root.classList.remove( 'gs-gl' );
			slider.emit( 'gl:off', !! lost );
			spare.canvas.remove();
			spare.lost = null;
			textures.destroy();
			g.deleteTexture( nothing );
			g.deleteVertexArray( mesh );
			buffers.forEach( ( buffer ) => g.deleteBuffer( buffer ) );
			if ( lost ) {
				// Gone.
			} else if ( spares.get( doc ).length < MAX_SPARE ) {
				spares.get( doc ).push( spare );
			} else {
				g.getExtension( 'WEBGL_lose_context' )?.loseContext();
			}
		}

		// The textures of the slides next to those in view, made while the
		// slider rests.
		const ahead = nearby( slider, media, boxes, ( element, w ) =>
			context?.textures.get(
				element,
				w * Math.min( density, win.devicePixelRatio || 1 )
			)
		);
		slider.on( 'settle', ahead );

		// Off the screen it lets go of its canvas and textures, a while
		// after: a page scrolled back and forth keeps them, and its slides
		// do not change from the page's to the canvas's and back.
		let leaving;
		const observer = new win.IntersectionObserver(
			( entries ) => {
				near = entries[ entries.length - 1 ].isIntersecting;
				win.clearTimeout( leaving );
				if ( near ) {
					attach();
				} else {
					leaving = win.setTimeout( detach, 3000 );
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
		// The first sign of use. A pointer that moves, not one that comes:
		// it may have been there when the slider was made.
		const want = () => {
			wanted = true;
			attach();
		};
		[ 'pointermove', 'pointerdown', 'focusin' ].forEach( ( name ) =>
			root.addEventListener( name, want, { ...listening, once: true } )
		);

		/**
		 * Binds the media of a slide to a texture unit and works out where
		 * its pixels are in the quad.
		 *
		 * @param {number} i    Slide, or -1 for none.
		 * @param {number} unit Texture unit.
		 * @param {number} x    The slide in the quad, px.
		 * @param {number} y    The slide in the quad, px.
		 * @param {number} qw   Width of the quad.
		 * @param {number} qh   Height of the quad.
		 * @return {Float32Array|null} Numbers of `fit()`; null when the
		 *                             canvas has nothing to draw.
		 */
		const bind = ( i, unit, x, y, qw, qh, element = media[ i ] ) => {
			const { g, textures, nothing } = context;
			const box = boxes[ i ];
			g.activeTexture( g.TEXTURE0 + unit );
			g.bindTexture( g.TEXTURE_2D, nothing );
			if ( ! element || ! box || ! box.at.w || ! box.at.h ) {
				return null;
			}
			const iw = element.naturalWidth || element.videoWidth;
			const ih = element.naturalHeight || element.videoHeight;
			if ( ! iw || ! ih ) {
				// Asks for it, so that the layer hears when it is there.
				textures.get( element, 0 );
				return null;
			}
			const out = numbers[ i ];
			// Another element is as large as its quad.
			const at = element === media[ i ] ? box.at : { w: qw, h: qh };
			at.x = x;
			at.y = y;
			const shown = fit( iw, ih, at, qw, qh, box.style, out );
			const record = textures.get( element, shown * ratio );
			show( element, !! record );
			if ( ! record ) {
				return null;
			}
			g.bindTexture( g.TEXTURE_2D, record.texture );
			return out;
		};

		// What the page and the lightbox make of a quad before it is drawn:
		// the hooks first, then `change`.
		const moved = ( i ) => {
			hooks.forEach( ( hook ) => hook( i, next ) );
			layer.change?.( i, next );
		};

		const layer = {
			name: 'gl',

			/** Makes a layer of this kind, for another slider. */
			again: gl,

			/** The canvas, while the layer draws. */
			get canvas() {
				return context?.spare.canvas || null;
			},

			/**
			 * Called with every slide of a row before it is drawn, with its
			 * index and its quad: `x`, `y`, `w`, `h` in px of the view,
			 * `a` (numbers of `fit()`), `radius`, `shape` and `speed`, which is
			 * added to the speed of the slider; `fx`, how much the effects
			 * do, 0 to 1; `dim`, what its colour is multiplied by; `clip`,
			 * whether it stays in the view; `p`, the progress of the slide;
			 * `top`, whether it is drawn over the others; and `media`,
			 * another element to take the picture of, while its texture is
			 * there. What it changes is drawn.
			 */
			change: null,

			/**
			 * An element the canvas goes into, over the whole of it, and
			 * draws the view where the view is: so that a slide can leave
			 * it. Null, back in the slider. Lifted, every slide is drawn,
			 * a stack as a row, and `change` says where.
			 */
			lift: null,

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
					kind = `${ shader.mesh }${ preserve }`;
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
						// moves, this does not. And where the track begins in
						// the root, after its padding.
						dx:
							( down ? y : x ) / scale +
							( down ? slider.track.offsetTop : slider.track.offsetLeft ),
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
				if ( making ) {
					begin();
				}
				if ( ! context ) {
					// A hook of the page is a use: it has nothing to change
					// without the canvas.
					if ( motion.dragging || motion.pos !== motion.target || hooks.size ) {
						want();
					}
					return;
				}
				const { g, at, indices, spare } = context;
				const to = Math.min( density, win.devicePixelRatio || 1 );
				// As high as the view gets: with auto height the view
				// changes on every frame, the canvas does not.
				const high = slider.plugins.autoHeight?.most || layout.height;
				if ( layer.lift !== lifted ) {
					lifted = layer.lift;
					( lifted || root ).prepend( spare.canvas );
					width = 0;
				}
				if ( layout.width !== width || high !== height || to !== ratio ) {
					width = layout.width;
					height = high;
					ratio = to;
					// Measured here, and drawn at once: a canvas of another
					// size is empty.
					const view = root.getBoundingClientRect();
					const over = lifted?.getBoundingClientRect();
					frame[ 0 ] = over ? view.left + root.clientLeft - over.left : 0;
					frame[ 1 ] = over ? view.top + root.clientTop - over.top : 0;
					frame[ 2 ] = over ? lifted.clientWidth : width;
					frame[ 3 ] = over ? lifted.clientHeight : height;
					spare.canvas.style.height = `${ frame[ 3 ] }px`;
					spare.canvas.width = Math.max( 1, Math.round( frame[ 2 ] * ratio ) );
					spare.canvas.height = Math.max( 1, Math.round( frame[ 3 ] * ratio ) );
					g.viewport( 0, 0, spare.canvas.width, spare.canvas.height );
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
				const turn = ( fn, x, y ) => ( down ? fn( y, x ) : fn( x, y ) );
				g.clear( g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT );
				turn( ( x, y ) => g.uniform2f( at.uView, x, y ), width, height );
				if ( down ) {
					g.uniform4f( at.uFrame, frame[ 1 ], frame[ 0 ], frame[ 3 ], frame[ 2 ] );
				} else {
					g.uniform4fv( at.uFrame, frame );
				}
				// What leaves the view is cut where the slider cuts it.
				g.scissor(
					frame[ 0 ] * ratio,
					( frame[ 3 ] - frame[ 1 ] - height ) * ratio,
					width * ratio,
					height * ratio
				);
				g.uniform1f( at.uTime, now / 1000 );
				g.uniform1f( at.uPointerIn, pointer.in );
				for ( const name in shader.params ) {
					const value = shader.params[ name ];
					g[ `uniform${ value.length }fv` ]( at[ name ], value );
				}
				// To the right on the screen, whatever the reading direction.
				const velocity = ( layout.rtl ? 1 : -1 ) * view.velocity;

				const quad = ( x, y, w, h, a, b, progress, mix, radius, speed, shape = 2, fx = 1, dim = 1, clip = true ) => {
					g.uniform1f( at.uVelocity, velocity + speed );
					g.uniform1f( at.uFx, fx );
					g.uniform1f( at.uDim, dim );
					g[ lifted && clip ? 'enable' : 'disable' ]( g.SCISSOR_TEST );
					if ( down ) {
						g.uniform4f( at.uQuad, y, x, h, w );
					} else {
						g.uniform4f( at.uQuad, x, y, w, h );
					}
					turn( ( u, v ) => g.uniform2f( at.uSize, u, v ), w, h );
					// In the quad as it is drawn, where effects lay it out.
					turn(
						( u, v ) => g.uniform2f( at.uPointer, u, v ),
						...( slider.plugins.hit?.uv( x, y, w, h, progress, pointer ) || [
							( pointer.x - x ) / w,
							( pointer.y - y ) / h,
						] )
					);
					turn(
						( u, v ) => g.uniform2f( at.uPointerSpeed, u, v ),
						pointer.vx / w,
						pointer.vy / h
					);
					g.uniform1f( at.uProgress, progress );
					g.uniform1f( at.uMix, mix );
					g.uniform1f( at.uRadius, radius );
					g.uniform1f( at.uShape, shape );
					g.uniform4f( at.uBoxA, a[ 0 ], a[ 1 ], a[ 2 ], a[ 3 ] );
					g.uniform4f( at.uRectA, a[ 4 ], a[ 5 ], a[ 6 ], a[ 7 ] );
					if ( b ) {
						g.uniform4f( at.uBoxB, b[ 0 ], b[ 1 ], b[ 2 ], b[ 3 ] );
						g.uniform4f( at.uRectB, b[ 4 ], b[ 5 ], b[ 6 ], b[ 7 ] );
					}
					g.uniform2f( at.uCut, a[ 8 ], b ? b[ 8 ] : 0 );
					g.drawElements( g.TRIANGLES, indices, g.UNSIGNED_SHORT, 0 );
				};

				// Lifted, every slide is drawn where `change` says.
				const panes = slider.plugins.panes;
				if ( stack && ! lifted ) {
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
					// The view is one quad; with `panes()` each place is
					// one, of the media of its slides where the place is.
					( panes?.ends() || [ [ from, upcoming, mix ] ] ).forEach( ( [ out, into, turned, x, i = out ] ) => {
						const box = panes && boxes[ i ];
						const { w, h } = box ? box.at : { w: width, h: height };
						const [ a, b ] = [ out, into ].map( ( k, unit, { dx = 0, dy = 0 } = box ? {} : boxes[ k ] || {} ) =>
							turn( ( u, v ) => bind( k, unit, u, v, w, h ), dx, dy )
						);
						if ( a || b ) {
							// As the other slides: one that the lightbox lets
							// grow out of the stack is drawn once, where it is.
							Object.assign( next, { x: 0, y: 0, w, h, a: a || EMPTY, radius: 0, shape: 2, speed: 0, fx: 1, dim: 1, clip: true }, box?.style );
							if ( box ) {
								turn( ( u, v ) => Object.assign( next, { x: u, y: v } ), x + box.dx, box.dy );
							}
							moved( i );
							quad( next.x, next.y, next.w, next.h, next.a, b || EMPTY, turned, turned, next.radius, next.speed, next.shape, next.fx, next.dim, next.clip );
						}
					} );
					return;
				}

				const { span, size, rtl } = layout;
				let top = null;
				places.forEach( ( place, i ) => {
					const box = boxes[ i ];
					// A view further on each side: what bends may reach in.
					if (
						! box ||
						( ! lifted &&
							( place.x + size[ i ] < -span || place.x > 2 * span ) )
					) {
						return;
					}
					const along =
						( rtl ? span - place.x - size[ i ] : place.x ) +
						( panes?.x( i ) || 0 ) +
						box.dx;
					next.a = bind( i, 0, 0, 0, box.at.w, box.at.h );
					// Lifted, `change` may have a picture where the page
					// has none yet.
					if ( next.a || lifted ) {
						turn(
							( x, y ) => {
								next.x = x;
								next.y = y;
							},
							along,
							box.dy
						);
						next.w = box.at.w;
						next.h = box.at.h;
						next.radius = box.style.radius;
						next.shape = box.style.shape;
						next.speed = 0;
						next.fx = 1;
						next.dim = 1;
						next.clip = true;
						next.top = false;
						next.media = null;
						next.p = place.p;
						moved( i );
						const { w, h, media: of } = next;
						if ( ! next.a ) {
							return;
						}
						const args = [ next.x, next.y, w, h, next.a, null, next.p, 0, next.radius, next.speed, next.shape, next.fx, next.dim, next.clip ];
						// The texture again, for the size it is drawn at, of
						// the element `change` gives if it has one yet.
						const draw = () => {
							( of && bind( i, 0, 0, 0, w, h, of ) ) ||
								bind( i, 0, 0, 0, w, h );
							quad( ...args );
						};
						// What grows out of the slider is drawn over the rest.
						if ( next.top ) {
							top = draw;
						} else {
							draw();
						}
					}
				} );
				top?.();
			},

			busy: () =>
				!! making ||
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
				win.clearTimeout( retry );
				observer.disconnect();
				detach();
			},
		};
		return layer;
	};
}

const EMPTY = new Float32Array( [ 1, 1, 0, 0, 0, 0, 0, 0, 0 ] );
