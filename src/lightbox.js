/**
 * A lightbox for the slides of a slider: a click on a slide lets its image
 * grow out of its place to the size of the screen, Escape lets it go back.
 *
 * The lightbox is a slider of its own in a `<dialog>`, so it can be
 * dragged, has arrows and keys, and the canvas draws it with the effects
 * it is given. The dialog brings what a lightbox needs: the page behind it
 * is inert, the focus stays inside and comes back, Escape closes.
 *
 * The growing is drawn by the canvas of the slider, lifted out of it for
 * the time: the image goes from where it is, cut as it is there and with
 * the effects of the slider, to the whole image, and the effects fade on
 * the way. There the canvas of the lightbox takes over, of the kind the
 * slider has: WebGPU, or WebGL. A slider without a canvas, or a stack,
 * has its image grow in the canvas of the lightbox, from the place it has
 * on the page; without any canvas the lightbox fades in.
 *
 *     createSlider( element, {
 *         plugins: [ gpu(), lightbox( { effects: [ stretch() ] } ) ],
 *     } );
 *
 * Events of the slider: `lightbox:open` and `lightbox:close`, both with the
 * index of the slide.
 *
 * Opens on a click on a slide, or on a `[data-gs-zoom]` in it. The image
 * of the lightbox is the one of the slide, in the size the browser picks
 * from its `srcset` for the whole screen, or the file in `data-gs-full`.
 */
import { createSlider } from './index.js';
import { controls } from './plugins/controls.js';
import { keyboard } from './plugins/keyboard.js';
import { fit, styleOf } from './gl/fit.js';

// The canvas layer of a slider, if it has one.
const layerOf = ( { plugins } ) => plugins.gpu || plugins.gl;

// The spring has arrived after about 9 / omega seconds (see engine.js).
const SETTLE = 9;

// The part of the way near the slide where the image of the lightbox and
// the one of the page fade into each other, when the lightbox draws the
// way; and near the screen, where its canvas takes over from the one of
// the slider, when that draws it.
const HANDOVER = 0.3;
const TAKEOVER = 0.8;

// How long the lightbox waits for the canvas to have the image before it
// opens without it, ms.
const PATIENCE = 400;

const NOT_A_CLICK = 'a, button, input, select, textarea, label, [data-gs-no-zoom]';

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
				const media = slide.querySelector( '.gs-media' );
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
		// The layer of the slider, while it draws the way; and the screen
		// in px of its view.
		let outer = null;
		let screen = null;

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
			seen.shape = style.shape;
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
			quad.shape = from.shape;
			quad.speed = still.matches ? 0 : speed * punch;
			quad.a = mixed;
		};

		// The same, drawn by the slider: its image grows out of it and its
		// effects fade, the rest goes dark as the page does.
		const grow = ( i, quad ) => {
			if ( i !== items[ active ]?.i ) {
				quad.dim = 1 - 0.92 * t;
				return;
			}
			const { media } = items[ active ];
			const iw = media.naturalWidth || media.videoWidth || quad.w;
			const ih = media.naturalHeight || media.videoHeight || quad.h;
			const k = Math.min( screen.w / iw, screen.h / ih );
			const seen = part( quad.a, quad.w, quad.h );
			const mix = ( a, b ) => a + ( b - a ) * t;
			for ( let n = 0; n < 4; n++ ) {
				mixed[ n ] = mix( seen.box[ n ], n < 2 ? 1 : 0 );
			}
			quad.x = mix( quad.x + seen.x, screen.x + ( screen.w - iw * k ) / 2 );
			quad.y = mix( quad.y + seen.y, screen.y + ( screen.h - ih * k ) / 2 );
			quad.w = mix( seen.w, iw * k );
			quad.h = mix( seen.h, ih * k );
			quad.radius = mix( quad.radius, 0 );
			quad.fx = 1 - t;
			quad.clip = false;
			quad.a = mixed;
		};

		// The slider draws the way, or stops.
		const lift = ( on ) => {
			if ( outer ) {
				outer.lift = on ? dialog : null;
				outer.change = on ? grow : null;
				slider.wake();
			}
		};

		// First layer of the slider in the lightbox: moves `t`.
		const driver = () => ( {
			frame( view, dt, now ) {
				since ||= now;
				const media = shown?.slides[ active ]?.querySelector( '.gs-media' );
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
				dialog.style.setProperty( '--gs-open', t.toFixed( 3 ) );
				dialog.style.setProperty(
					'--gs-canvas',
					Math.min(
						1,
						outer
							? Math.max( 0, t - TAKEOVER ) / ( 1 - TAKEOVER )
							: t / HANDOVER
					).toFixed( 3 )
				);
				if ( outer ) {
					if ( t === 1 && to === 1 ) {
						// Open: the slider draws itself again, under the
						// lightbox.
						lift( false );
					} else {
						slider.wake();
					}
				}
				if ( started && to === 0 && t === 0 ) {
					// After this frame: the slider is still drawing.
					win.setTimeout( finish, 0 );
				}
			},
			busy: () => ! started || t !== to,
		} );

		function build() {
			dialog = doc.createElement( 'dialog' );
			dialog.className = 'gs-lightbox';
			dialog.setAttribute( 'aria-label', labels.dialog || 'Image viewer' );
			const button = ( name, label ) =>
				`<button type="button" class="gs-button gs-${ name }" data-gs-${ name } aria-label="${ label }"></button>`;
			dialog.innerHTML =
				'<div class="gs gs-box"><div class="gs-track"></div>' +
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
				if ( event.target.closest( '[data-gs-close]' ) ) {
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

		// Whether a pointer opened it: then the focus goes back without the
		// ring that says where the keys are.
		let pointed = false;

		function show( item, byPointer = false ) {
			if ( shown || ! items[ item ] ) {
				return;
			}
			pointed = byPointer;
			if ( ! dialog ) {
				build();
			}
			const track = box.firstChild;
			track.replaceChildren(
				...items.map( ( { media } ) => {
					const slide = doc.createElement( 'div' );
					slide.className = 'gs-slide';
					const copy = media.cloneNode();
					copy.className = 'gs-media';
					copy.removeAttribute( 'loading' );
					copy.removeAttribute( 'style' );
					if ( media.dataset.gsFull ) {
						copy.removeAttribute( 'srcset' );
						copy.src = media.dataset.gsFull;
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
			outer = layerOf( slider );
			outer = outer?.canvas && ! slider.layout().stack ? outer : null;
			if ( outer ) {
				const r = root.getBoundingClientRect();
				screen = {
					x: -r.left - root.clientLeft,
					y: -r.top - root.clientTop,
					w: dialog.clientWidth,
					h: dialog.clientHeight,
				};
				lift( true );
			} else {
				from = place( item );
			}
			dialog.style.setProperty( '--gs-open', 0 );
			dialog.style.setProperty( '--gs-canvas', 0 );
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
			if ( layer && ! outer ) {
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
					if ( outer ) {
						lift( true );
					} else {
						from = place( active );
					}
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
			if ( outer?.lift ) {
				// The dialog goes once the slider has drawn itself where it
				// is again: its canvas is in it until then.
				lift( false );
				const off = slider.on( 'frame', () => {
					off();
					finish();
				} );
				return;
			}
			shown.destroy();
			shown = null;
			layer = null;
			from = null;
			box.firstChild.replaceChildren();
			dialog.close();
			const back = doc.activeElement;
			if ( pointed && back !== doc.body ) {
				back.blur();
				back.focus( { preventScroll: true, focusVisible: false } );
			}
			slider.emit( 'lightbox:close', items[ active ]?.i );
			if ( ! wasPaused ) {
				slider.plugins.autoplay?.play();
			}
		}

		const off = slider.on( 'click', ( { index, event } ) => {
			const zoom = event.target.closest( '[data-gs-zoom]' );
			if (
				! event.defaultPrevented &&
				( zoom || ! event.target.closest( NOT_A_CLICK ) )
			) {
				show(
					items.findIndex( ( { i } ) => i === index ),
					// A click of the keys has no count of clicks.
					event.detail > 0
				);
			}
		} );
		root.classList.add( 'gs-zooms' );

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
				lift( false );
				root.classList.remove( 'gs-zooms' );
				shown?.destroy();
				shown = null;
				dialog?.remove();
				dialog = null;
			},
		};
	};
}
