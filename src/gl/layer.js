/**
 * The canvas layer: draws the media of the slides with WebGL 2.
 *
 * The page keeps everything else. The media elements stay where they are
 * and become transparent once the canvas shows them; slide content lies
 * above the canvas. Without WebGL 2, without a free context or after a
 * lost one, the layer does nothing and the page shows its own media.
 *
 * Nothing here reads the layout while the slider moves: the boxes of the
 * media are measured with the layout, the rest is arithmetic.
 */
import { compose, build } from './program.js';
import { createTextures } from './textures.js';
import { fit, styleOf } from './fit.js';

// Contexts in use. Browsers drop the oldest beyond about 16 per page.
const MAX_LIVE = 12;
let live = 0;

// Canvases of sliders that went off screen, with their context, by
// document: a context is only freed when the browser collects it, so
// creating new ones for sliders that come and go would still hit the limit.
const spares = new WeakMap();

// Sliders in view that found no context: they try again when one is free.
const waiting = new Set();

// Squares per side of a quad that bends.
const MESH = 32;

// How fast the pointer of the shader follows the real one, per second.
const FOLLOW = 8;

const FADE = 'return mix( getFromColor( uv ), getToColor( uv ), progress );';

/**
 * @param {Object}   [options]             Options.
 * @param {Object[]} [options.effects]     Effects, in the order they apply.
 * @param {number}   [options.maxSize]     Largest side of a texture, px.
 * @param {number}   [options.density]     Most device pixels per px drawn.
 * @param {number}   [options.perspective] Distance of the eye for meshes
 *                                         that bend, px.
 * @param {boolean}  [options.preserve]    Keep the drawing readable, for
 *                                         tests and screenshots.
 * @return {Function} Layer, for the `layers` of a slider.
 */
export function gl( {
	effects = [],
	maxSize = 2048,
	density = 2,
	perspective = 1200,
	preserve = false,
} = {} ) {
	return ( slider ) => {
		const { root, slides, win } = slider;
		const doc = root.ownerDocument;
		const stack = slider.options.mode === 'stack';
		const shader = compose( effects, stack ? FADE : null );
		const media = slides.map( ( slide ) =>
			slide.querySelector( '.ss-media' )
		);
		// Per slide: the box of the media in its slide and what CSS says.
		const boxes = slides.map( () => null );
		const numbers = slides.map( () => new Float32Array( 9 ) );
		const kind = `${ shader.mesh }${ preserve }`;

		let context = null;
		let near = false;
		let destroyed = false;
		let retry = 0;
		let width = 0;
		let height = 0;
		let ratio = 0;
		const pointer = { x: 0, y: 0, in: 0, tx: 0, ty: 0, tin: 0, moving: false };
		const drawn = new Set();

		const show = ( element, on ) => {
			if ( on !== drawn.has( element ) ) {
				element.classList.toggle( 'ss-drawn', on );
				drawn[ on ? 'add' : 'delete' ]( element );
			}
		};

		function attach() {
			if ( context || destroyed || ! near ) {
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
				if ( live >= MAX_LIVE ) {
					waiting.add( attach );
					return;
				}
				const canvas = doc.createElement( 'canvas' );
				const made = canvas.getContext( 'webgl2', {
					alpha: true,
					premultipliedAlpha: true,
					antialias: shader.mesh,
					depth: shader.mesh,
					preserveDrawingBuffer: preserve,
				} );
				if ( ! made ) {
					return;
				}
				canvas.className = 'ss-canvas';
				canvas.setAttribute( 'aria-hidden', 'true' );
				spare = { canvas, gl: made, kind, programs: new Map() };
				canvas.addEventListener( 'webglcontextlost', ( event ) => {
					event.preventDefault();
					spare.lost?.();
				} );
			}
			waiting.delete( attach );
			const { canvas, programs } = spare;
			const g = spare.gl;
			let program = programs.get( shader.fragment + shader.vertex );
			if ( ! program ) {
				try {
					program = build( g, shader.vertex, shader.fragment );
				} catch ( error ) {
					// eslint-disable-next-line no-console
					console.error( 'shaderslide: the shader failed.', error );
					pool.push( spare );
					destroyed = true;
					return;
				}
				programs.set( shader.fragment + shader.vertex, program );
			}
			live++;
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
			for ( const [ name, value ] of Object.entries( shader.params ) ) {
				g[ `uniform${ value.length }fv` ]( at[ name ], value );
			}

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
			root.classList.add( 'ss-gl' );
			slider.wake();
		}

		function detach( lost ) {
			waiting.delete( attach );
			if ( ! context ) {
				return;
			}
			const { spare, g, mesh, buffers, nothing, textures } = context;
			context = null;
			live--;
			drawn.forEach( ( element ) => show( element, false ) );
			root.classList.remove( 'ss-gl' );
			spare.canvas.remove();
			spare.lost = null;
			textures.destroy();
			g.deleteTexture( nothing );
			g.deleteVertexArray( mesh );
			buffers.forEach( ( buffer ) => g.deleteBuffer( buffer ) );
			if ( ! lost ) {
				spares.get( doc ).push( spare );
			}
			[ ...waiting ].forEach( ( other ) => other() );
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
		const events = shader.pointer
			? [
					[ 'pointerdown', move ],
					[ 'pointermove', move ],
					[ 'pointerleave', leave ],
					[ 'pointerup', leave ],
					[ 'pointercancel', leave ],
			  ]
			: [];
		events.forEach( ( [ name, fn ] ) =>
			root.addEventListener( name, fn, { passive: true } )
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
		const bind = ( i, unit, x, y, qw, qh ) => {
			const { g, textures, nothing } = context;
			const element = media[ i ];
			const box = boxes[ i ];
			g.activeTexture( g.TEXTURE0 + unit );
			g.bindTexture( g.TEXTURE_2D, nothing );
			if ( ! element || ! box || ! box.w || ! box.h ) {
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
			box.at.x = x;
			box.at.y = y;
			const shown = fit( iw, ih, box.at, qw, qh, box.style, out );
			const record = textures.get( element, shown * ratio );
			show( element, !! record );
			if ( ! record ) {
				return null;
			}
			g.bindTexture( g.TEXTURE_2D, record.texture );
			return out;
		};

		return {
			/** The canvas, while the layer draws. */
			get canvas() {
				return context?.spare.canvas || null;
			},

			measure() {
				const around = root.getBoundingClientRect();
				const scale = root.offsetWidth
					? around.width / root.offsetWidth || 1
					: 1;
				slides.forEach( ( slide, i ) => {
					const element = media[ i ];
					if ( ! element ) {
						return;
					}
					const outer = slide.getBoundingClientRect();
					const inner = element.getBoundingClientRect();
					boxes[ i ] = {
						// In the slide: the slide moves, this does not.
						dx: ( inner.left - outer.left ) / scale,
						// In the view: slides do not move up or down.
						dy: ( inner.top - around.top ) / scale - root.clientTop,
						w: inner.width / scale,
						h: inner.height / scale,
						at: { x: 0, y: 0, w: inner.width / scale, h: inner.height / scale },
						style: styleOf( element ),
					};
				} );
			},

			frame( view, dt, now ) {
				if ( ! context ) {
					return;
				}
				const { g, at, indices, spare } = context;
				const { layout, places } = view;
				const to = Math.min( density, win.devicePixelRatio || 1 );
				if (
					layout.width !== width ||
					layout.height !== height ||
					to !== ratio
				) {
					( { width, height } = layout );
					ratio = to;
					spare.canvas.width = Math.max( 1, Math.round( width * ratio ) );
					spare.canvas.height = Math.max( 1, Math.round( height * ratio ) );
					g.viewport( 0, 0, spare.canvas.width, spare.canvas.height );
				}

				const follow = 1 - Math.exp( -FOLLOW * dt );
				pointer.x += ( pointer.tx - pointer.x ) * follow;
				pointer.y += ( pointer.ty - pointer.y ) * follow;
				pointer.in += ( pointer.tin - pointer.in ) * follow;
				pointer.moving =
					Math.abs( pointer.tx - pointer.x ) > 0.1 ||
					Math.abs( pointer.ty - pointer.y ) > 0.1 ||
					Math.abs( pointer.tin - pointer.in ) > 0.002;
				if ( ! pointer.moving ) {
					pointer.in = pointer.tin;
				}

				g.clear( g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT );
				g.uniform2f( at.uView, width, height );
				g.uniform1f( at.uTime, now / 1000 );
				g.uniform1f( at.uPointerIn, pointer.in );
				// To the right on the screen, whatever the reading direction.
				g.uniform1f(
					at.uVelocity,
					( layout.rtl ? 1 : -1 ) * view.velocity
				);

				const quad = ( x, y, w, h, a, b, progress, mix, radius ) => {
					g.uniform4f( at.uQuad, x, y, w, h );
					g.uniform2f( at.uSize, w, h );
					g.uniform2f(
						at.uPointer,
						( pointer.x - x ) / w,
						( pointer.y - y ) / h
					);
					g.uniform1f( at.uProgress, progress );
					g.uniform1f( at.uMix, mix );
					g.uniform1f( at.uRadius, radius );
					g.uniform4f( at.uBoxA, a[ 0 ], a[ 1 ], a[ 2 ], a[ 3 ] );
					g.uniform4f( at.uRectA, a[ 4 ], a[ 5 ], a[ 6 ], a[ 7 ] );
					if ( b ) {
						g.uniform4f( at.uBoxB, b[ 0 ], b[ 1 ], b[ 2 ], b[ 3 ] );
						g.uniform4f( at.uRectB, b[ 4 ], b[ 5 ], b[ 6 ], b[ 7 ] );
					}
					g.uniform2f( at.uCut, a[ 8 ], b ? b[ 8 ] : 0 );
					g.drawElements( g.TRIANGLES, indices, g.UNSIGNED_SHORT, 0 );
				};

				if ( stack ) {
					// The slide the position has passed, and the one it
					// moves to.
					let from = -1;
					let next = -1;
					let mix = 0;
					places.forEach( ( { p }, i ) => {
						if ( p <= 0 && p > -1 ) {
							from = i;
							mix = -p;
						} else if ( p > 0 && p < 1 ) {
							next = i;
						}
					} );
					const a = bind(
						from,
						0,
						boxes[ from ]?.dx || 0,
						boxes[ from ]?.dy || 0,
						width,
						height
					);
					const b = bind(
						next,
						1,
						boxes[ next ]?.dx || 0,
						boxes[ next ]?.dy || 0,
						width,
						height
					);
					if ( a || b ) {
						quad( 0, 0, width, height, a || EMPTY, b || EMPTY, mix, mix, 0 );
					}
					return;
				}

				const mirror = layout.rtl;
				places.forEach( ( place, i ) => {
					const box = boxes[ i ];
					// A view further on each side: what bends may reach in.
					if (
						! box ||
						place.x + layout.size[ i ] < -width ||
						place.x > 2 * width
					) {
						return;
					}
					const x = mirror
						? width - place.x - layout.size[ i ] + box.dx
						: place.x + box.dx;
					const a = bind( i, 0, 0, 0, box.w, box.h );
					if ( a ) {
						quad( x, box.dy, box.w, box.h, a, null, place.p, 0, box.style.radius );
					}
				} );
			},

			busy: () =>
				!! context &&
				( pointer.moving ||
					shader.animated ||
					media.some(
						( element, i ) =>
							element?.tagName === 'VIDEO' &&
							! element.paused &&
							slider.view.places[ i ].visible &&
							! ( 'requestVideoFrameCallback' in element )
					) ),

			destroy() {
				destroyed = true;
				win.clearTimeout( retry );
				observer.disconnect();
				events.forEach( ( [ name, fn ] ) =>
					root.removeEventListener( name, fn )
				);
				detach();
			},
		};
	};
}

const EMPTY = new Float32Array( [ 1, 1, 0, 0, 0, 0, 0, 0, 0 ] );
