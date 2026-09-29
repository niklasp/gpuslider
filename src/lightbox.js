/**
 * A lightbox for the slides of a slider: a click on a slide lets its image
 * grow out of its place to the size of the screen, Escape lets it go back.
 *
 * The lightbox is a slider of its own in a `<dialog>`, so it can be
 * dragged, has arrows and keys, and the canvas draws it with the effects
 * it is given. The dialog brings what a lightbox needs: the page behind it
 * is inert, the focus stays inside and comes back, Escape closes.
 *
 * The growing is drawn by the canvas: one quad that goes from the image in
 * the slide, cut as it is there, to the whole image. The canvas of the
 * lightbox is of the kind the slider has: WebGPU, or WebGL. Without a
 * canvas the lightbox fades in.
 *
 *     createSlider( element, {
 *         plugins: [ gpu(), lightbox( { effects: [ stretch() ] } ) ],
 *     } );
 *
 * Events of the slider: `lightbox:open` and `lightbox:close`, both with the
 * index of the slide.
 *
 * Opens on a click on a slide, or on a `[data-ss-zoom]` in it. The image
 * of the lightbox is the one of the slide, in the size the browser picks
 * from its `srcset` for the whole screen, or the file in `data-ss-full`.
 */
import { createSlider } from './index.js';
import { controls } from './plugins/controls.js';
import { keyboard } from './plugins/keyboard.js';
import { fit, styleOf } from './gl/fit.js';

// The canvas layer of a slider, if it has one.
const layerOf = ( { plugins } ) => plugins.gpu || plugins.gl;

// The spring has arrived after about 9 / omega seconds (see engine.js).
const SETTLE = 9;

// How long the lightbox waits for the canvas to have the image before it
// opens without it, ms.
const PATIENCE = 400;

const NOT_A_CLICK = 'a, button, input, select, textarea, label, [data-ss-no-zoom]';

/**
 * @param {Object}   [options]          Options.
 * @param {import('./gl/program.js').Effect[]} [options.effects] Effects of
 *                                      the canvas.
 * @param {number}   [options.duration] Time of opening and closing, ms.
 * @param {number}   [options.punch]    How much the speed of the opening
 *                                      counts as speed for the effects.
 *                                      0: the image grows, and no more.
 * @param {import('./index.js').Options} [options.slider] Options for the
 *                                      slider in the lightbox.
 * @param {Object}   [options.canvas]   Options for its canvas layer.
 * @param {Function} [options.layer]    The canvas layer, `gpu` or `gl`,
 *                                      when it is not to be the one of the
 *                                      slider.
 * @param {Record<string, string>} [options.labels] `close`, `prev`,
 *                                      `next`, `dialog`.
 */
export function lightbox( {
	effects = [],
	duration = 500,
	punch = 0,
	slider: inner = {},
	canvas = {},
	layer: given,
	labels = {},
} = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('./index.js').Slider} */ slider ) => {
		const { root, slides, win } = slider;
		const doc = root.ownerDocument;
		const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
		// The slides that have something to show.
		let items = [];
		const read = () => {
			items = slides.flatMap( ( slide, i ) => {
				const media = slide.querySelector( '.ss-media' );
				return media ? [ { i, media } ] : [];
			} );
		};
		read();

		let dialog = null;
		let box = null;
		// The slider in the lightbox, while it is open.
		let shown = null;
		let layer = null;
		// How far it is open, where that goes and how fast.
		let t = 0;
		let to = 0;
		let speed = 0;
		let started = false;
		let since = 0;
		// The slide that grows or shrinks, and the place it comes from.
		let active = -1;
		let from = null;
		let wasPaused = false;

		const numbers = new Float32Array( 13 );
		const mixed = new Float32Array( 13 );
		mixed[ 6 ] = 1;
		mixed[ 7 ] = 1;

		// The part of an image that its element shows: in px of the
		// element, and as a box from that part to the texture.
		const part = ( a, w, h ) => {
			const x0 = Math.max( a[ 9 ], 0 );
			const y0 = Math.max( a[ 10 ], 0 );
			const x1 = Math.min( a[ 9 ] + a[ 11 ], w );
			const y1 = Math.min( a[ 10 ] + a[ 12 ], h );
			return {
				x: x0,
				y: y0,
				w: x1 - x0,
				h: y1 - y0,
				box: [
					( x1 - x0 ) / a[ 11 ],
					( y1 - y0 ) / a[ 12 ],
					( x0 - a[ 9 ] ) / a[ 11 ],
					( y0 - a[ 10 ] ) / a[ 12 ],
				],
			};
		};

		// Where the image of a slide is on the screen, in px of the
		// lightbox.
		const place = ( item ) => {
			const { media } = items[ item ];
			const r = media.getBoundingClientRect();
			const around = box.getBoundingClientRect();
			const style = styleOf( media );
			fit(
				media.naturalWidth || media.videoWidth || r.width,
				media.naturalHeight || media.videoHeight || r.height,
				{ x: 0, y: 0, w: r.width, h: r.height },
				r.width,
				r.height,
				style,
				numbers
			);
			const seen = part( numbers, r.width, r.height );
			// Where the canvas draws it, which an effect may have moved.
			const drawn = slider.plugins.hit?.where( items[ item ].i ) || r;
			const wide = drawn.width / r.width;
			const high = drawn.height / r.height;
			seen.x = seen.x * wide + drawn.left - around.left;
			seen.y = seen.y * high + drawn.top - around.top;
			seen.w *= wide;
			seen.h *= high;
			seen.radius = style.radius;
			return seen;
		};

		// Between the place in the slide and the whole image.
		const change = ( i, quad ) => {
			if ( i !== active || ! from || t >= 1 ) {
				return;
			}
			const whole = part( quad.a, quad.w, quad.h );
			const mix = ( a, b ) => a + ( b - a ) * t;
			for ( let k = 0; k < 4; k++ ) {
				mixed[ k ] = mix( from.box[ k ], whole.box[ k ] );
			}
			quad.x = mix( from.x, quad.x + whole.x );
			quad.y = mix( from.y, quad.y + whole.y );
			quad.w = mix( from.w, whole.w );
			quad.h = mix( from.h, whole.h );
			quad.radius = mix( from.radius, 0 );
			quad.speed = still.matches ? 0 : speed * punch;
			quad.a = mixed;
		};

		// First layer of the slider in the lightbox: moves `t`.
		const driver = () => ( {
			frame( view, dt, now ) {
				since ||= now;
				const media = shown?.slides[ active ]?.querySelector( '.ss-media' );
				if ( ! started ) {
					// Not before the canvas has the image, or it would pop
					// in half way.
					started =
						now - since > PATIENCE ||
						( layer?.canvas ? layer.shows( media ) : now - since > 50 );
				} else if ( still.matches ) {
					t = to;
					speed = 0;
				} else if ( t !== to || speed !== 0 ) {
					const omega = SETTLE / ( Math.max( 1, duration ) / 1000 );
					const a = t - to;
					const b = speed + omega * a;
					const e = Math.exp( -omega * dt );
					t = to + ( a + b * dt ) * e;
					speed = ( b - omega * ( a + b * dt ) ) * e;
					if ( Math.abs( t - to ) < 0.001 && Math.abs( speed ) < 0.02 ) {
						t = to;
						speed = 0;
					}
				}
				dialog.style.setProperty( '--ss-open', t.toFixed( 3 ) );
				if ( started && to === 0 && t === 0 ) {
					// After this frame: the slider is still drawing.
					win.setTimeout( finish, 0 );
				}
			},
			busy: () => ! started || t !== to,
		} );

		function build() {
			dialog = doc.createElement( 'dialog' );
			dialog.className = 'ss-lightbox';
			dialog.setAttribute( 'aria-label', labels.dialog || 'Image viewer' );
			const button = ( name, label ) =>
				`<button type="button" class="ss-button ss-${ name }" data-ss-${ name } aria-label="${ label }"></button>`;
			dialog.innerHTML =
				'<div class="ss ss-box"><div class="ss-track"></div>' +
				button( 'close', labels.close || 'Close' ) +
				button( 'prev', labels.prev || 'Previous' ) +
				button( 'next', labels.next || 'Next' ) +
				'</div>';
			box = dialog.firstChild;
			// Escape: the way back is drawn before the dialog closes.
			dialog.addEventListener( 'cancel', ( event ) => {
				event.preventDefault();
				hide();
			} );
			dialog.addEventListener( 'click', ( event ) => {
				if ( event.target.closest( '[data-ss-close]' ) ) {
					hide();
					return;
				}
				if ( event.target.closest( 'button' ) || ! shown ) {
					return;
				}
				// Next to the image, not on it.
				const media = shown.slides[ shown.index ].firstChild;
				const r = media.getBoundingClientRect();
				fit(
					media.naturalWidth || media.videoWidth || r.width,
					media.naturalHeight || media.videoHeight || r.height,
					{ x: 0, y: 0, w: r.width, h: r.height },
					r.width,
					r.height,
					styleOf( media ),
					numbers
				);
				const seen = part( numbers, r.width, r.height );
				const x = event.clientX - r.left - seen.x;
				const y = event.clientY - r.top - seen.y;
				if ( x < 0 || y < 0 || x > seen.w || y > seen.h ) {
					hide();
				}
			} );
			doc.body.append( dialog );
		}

		function show( item ) {
			if ( shown || ! items[ item ] ) {
				return;
			}
			if ( ! dialog ) {
				build();
			}
			const track = box.firstChild;
			track.replaceChildren(
				...items.map( ( { media } ) => {
					const slide = doc.createElement( 'div' );
					slide.className = 'ss-slide';
					const copy = media.cloneNode();
					copy.className = 'ss-media';
					copy.removeAttribute( 'loading' );
					copy.removeAttribute( 'style' );
					if ( media.dataset.ssFull ) {
						copy.removeAttribute( 'srcset' );
						copy.src = media.dataset.ssFull;
					} else if ( copy.srcset ) {
						copy.sizes = '100vw';
					}
					if ( copy.tagName === 'VIDEO' ) {
						copy.autoplay = true;
						copy.muted = true;
					}
					slide.append( copy );
					return slide;
				} )
			);
			wasPaused = slider.plugins.autoplay?.paused;
			slider.plugins.autoplay?.pause();
			dialog.showModal();
			t = 0;
			to = 1;
			speed = 0;
			started = false;
			since = 0;
			active = item;
			from = place( item );
			dialog.style.setProperty( '--ss-open', 0 );
			layer = null;
			const draws = given || layerOf( slider )?.again;
			shown = createSlider( box, {
				loop: slider.layout().loop && items.length > 2,
				...inner,
				perView: 1,
				gap: 0,
				start: item,
				plugins: [
					driver,
					controls(),
					keyboard(),
					draws?.( { effects, ...canvas, eager: true } ),
				],
			} );
			layer = layerOf( shown );
			if ( layer ) {
				layer.change = change;
			}
			box.focus( { preventScroll: true } );
			slider.emit( 'lightbox:open', items[ item ].i );
		}

		function hide() {
			if ( ! shown || to === 0 ) {
				return;
			}
			active = shown.index;
			const { i } = items[ active ];
			// The slide it goes back to is where the visitor left the
			// lightbox, and in view.
			if ( ! slider.view.places[ i ].visible ) {
				slider.to( slider.layout().snapOf[ i ], { instant: true } );
			}
			// Measured after the slider has put its slides in place.
			win.requestAnimationFrame( () => {
				if ( shown ) {
					from = place( active );
					started = true;
					to = 0;
					shown.wake();
				}
			} );
		}

		function finish() {
			if ( ! shown ) {
				return;
			}
			shown.destroy();
			shown = null;
			layer = null;
			from = null;
			box.firstChild.replaceChildren();
			dialog.close();
			slider.emit( 'lightbox:close', items[ active ]?.i );
			if ( ! wasPaused ) {
				slider.plugins.autoplay?.play();
			}
		}

		const off = slider.on( 'click', ( { index, event } ) => {
			const zoom = event.target.closest( '[data-ss-zoom]' );
			if (
				! event.defaultPrevented &&
				( zoom || ! event.target.closest( NOT_A_CLICK ) )
			) {
				show( items.findIndex( ( { i } ) => i === index ) );
			}
		} );
		root.classList.add( 'ss-zooms' );

		return {
			name: 'lightbox',
			slides: read,

			/**
			 * @param {number} index Slide to open the lightbox with.
			 */
			open: ( index ) =>
				show( items.findIndex( ( { i } ) => i === index ) ),
			/** Lets the image go back to its slide. */
			close: hide,
			/** The slider in the lightbox, while it is open. */
			get slider() {
				return shown;
			},
			/** How far the lightbox is open, 0 to 1. */
			get progress() {
				return t;
			},

			destroy() {
				off();
				root.classList.remove( 'ss-zooms' );
				shown?.destroy();
				shown = null;
				dialog?.remove();
				dialog = null;
			},
		};
	};
}
