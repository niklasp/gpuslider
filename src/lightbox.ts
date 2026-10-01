/**
 * A lightbox for the slides of a slider: a click on a slide lets its image
 * grow out of its place to the size of the screen, Escape lets it go back.
 *
 * One canvas draws all of it: the one of the slider, lifted out of it into
 * a `<dialog>` for as long as the lightbox is open. The image grows from
 * where it is, cut as it is there and with the effects of the slider, to
 * the whole image, and the effects fade on the way. Open, the canvas draws
 * the images where a slider of the lightbox has them: that slider is HTML
 * that is not seen, so it can be dragged, has arrows and keys, and its
 * images are the ones in the size of the screen. The dialog brings what a
 * lightbox needs: the page behind it is inert, the focus stays inside and
 * comes back, Escape closes. A slider without a canvas has its lightbox
 * fade in.
 *
 *     createSlider( element, { plugins: [ gpu(), lightbox() ] } );
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
import type { Options, Plugin, Slider } from './index.js';
import type { Hook } from './canvas.js';
import type { Media } from './gl/layer.js';

/** What the lightbox uses of a canvas layer. */
interface Layer {
	canvas: HTMLCanvasElement | null;
	lift: HTMLElement | null;
	change: Hook | null;
}

/** An area of the screen, px. */
interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

// The canvas layer of a slider, if it has one.
const layerOf = ( { plugins }: Slider ): Layer | undefined => plugins.gpu || plugins.gl;

// The spring has arrived after about 9 / omega seconds (see engine.js).
const SETTLE = 9;

// The part of the way over which the effects of the slider fade.
const FADE = 0.8;

const NOT_A_CLICK = 'a, button, input, select, textarea, label, [data-gs-no-zoom]';

/**
 * @param options Options.
 * @param options.duration Time of opening and closing, ms.
 * @param options.punch How much the speed of the opening
 *                      counts as speed for the effects.
 *                      0: the image grows, and no more.
 * @param options.slider Options for the
 *                                      slider in the lightbox.
 * @param options.labels `close`, `prev`,
 *                                      `next`, `dialog`.
 */
export function lightbox( {
	duration = 500,
	punch = 0,
	slider: inner = {},
	labels = {},
}: {
	duration?: number;
	punch?: number;
	slider?: Options;
	labels?: Record< string, string >;
} = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { root, slides, win } = slider;
		const doc = root.ownerDocument;
		const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
		// The slides that have something to show.
		let items: { i: number; _media: Media }[] = [];
		// Which item a slide is, by its index.
		let of: number[] = [];
		const read = () => {
			of = [];
			items = slides.flatMap( ( slide, i ) => {
				const media = slide.querySelector( '.gs-media' ) as Media | null;
				return media ? [ { i, _media: media } ] : [];
			} );
			items.forEach( ( item, k ) => ( of[ item.i ] = k ) );
		};
		read();

		let dialog: HTMLDialogElement | null = null;
		let box = null as unknown as HTMLElement;
		// The slider in the lightbox, while it is open.
		let shown: Slider | null = null;
		// How far it is open, where that goes and how fast.
		let t = 0;
		let to = 0;
		let speed = 0;
		let started = false;
		let since = 0;
		// The item that grows or shrinks.
		let active = -1;
		let wasPaused = false;
		// The layer of the slider, while it draws the lightbox; and the
		// screen in px of its view.
		let outer: Layer | null | undefined = null;
		let screen = null as unknown as Rect;
		// The arrows of the slider, each with the one of the lightbox that
		// comes from where it is.
		let arrows: [ HTMLElement, HTMLElement ][] = [];

		const numbers = new Float32Array( 13 );
		const mixed = new Float32Array( 13 );
		mixed[ 6 ] = 1;
		mixed[ 7 ] = 1;
		// The whole image.
		const whole = mixed.slice();
		whole[ 0 ] = 1;
		whole[ 1 ] = 1;

		// The part of an image that its element shows: in px of the
		// element, and as a box from that part to the texture.
		const part = ( a: Float32Array, w: number, h: number ) => {
			const x0 = Math.max( a[ 9 ], 0 );
			const y0 = Math.max( a[ 10 ], 0 );
			const x1 = Math.min( a[ 9 ] + a[ 11 ], w );
			const y1 = Math.min( a[ 10 ] + a[ 12 ], h );
			return {
				x: x0,
				y: y0,
				w: x1 - x0,
				h: y1 - y0,
				_box: [
					( x1 - x0 ) / a[ 11 ],
					( y1 - y0 ) / a[ 12 ],
					( x0 - a[ 9 ] ) / a[ 11 ],
					( y0 - a[ 10 ] ) / a[ 12 ],
				],
			};
		};

		// Where the lightbox has the image of an item, whole, in px of the
		// view of the slider; null while it has none.
		const target = ( k: number ) => {
			const media = shown?.slides[ k ]?.firstChild as Media | null | undefined;
			if ( ! media ) {
				return null;
			}
			const r = media.getBoundingClientRect();
			const page = items[ k ]._media;
			const iw = media.naturalWidth || media.videoWidth || page.naturalWidth || page.videoWidth || r.width;
			const ih = media.naturalHeight || media.videoHeight || page.naturalHeight || page.videoHeight || r.height;
			const k2 = Math.min( r.width / iw, r.height / ih );
			return {
				x: screen.x + r.left + ( r.width - iw * k2 ) / 2,
				y: screen.y + r.top + ( r.height - ih * k2 ) / 2,
				w: iw * k2,
				h: ih * k2,
				media,
			};
		};

		// What the canvas of the slider draws while it is lifted: the item
		// that grows goes from its slide to its place in the lightbox, and
		// the rest of the slider goes dark as the page does. Open, the
		// items that the lightbox shows are drawn where it has them, and
		// nothing else.
		const grow: Hook = ( i, quad ) => {
			const k = of[ i ] ?? -1;
			// Measured only where it is used: the item that grows, and open
			// the ones in view.
			const it = k >= 0 && ( k === active || t === 1 ) ? target( k ) : null;
			// Whether the page has the picture of the slide yet.
			const had = !! quad.a;
			if ( it && k === active ) {
				const seen = had
					? part( quad.a!, quad.w, quad.h )
					: { x: 0, y: 0, w: quad.w, h: quad.h, _box: whole };
				const mix = ( a: number, b: number ) => a + ( b - a ) * t;
				for ( let n = 0; n < 4; n++ ) {
					mixed[ n ] = mix( seen._box[ n ], whole[ n ] );
				}
				quad.x = mix( quad.x + seen.x, it.x );
				quad.y = mix( quad.y + seen.y, it.y );
				quad.w = mix( seen.w, it.w );
				quad.h = mix( seen.h, it.h );
				quad.radius = mix( quad.radius, 0 );
				// Where an effect lays it out, it comes out of that place.
				quad.p = mix( quad.p, 0 );
				quad.fx = Math.max( 0, 1 - t / FADE );
				quad.speed = still.matches ? 0 : speed * punch;
				quad.a = mixed;
				quad.top = true;
			} else if (
				it &&
				t === 1 &&
				it.x < screen.x + screen.w &&
				it.x + it.w > screen.x
			) {
				Object.assign( quad, it, { a: whole, radius: 0, fx: 0, p: 0 } );
			} else {
				// Open, what the lightbox does not show is not drawn: it
				// would be over what it shows. So it fades out all the way,
				// and does not go at once from what the backdrop leaves.
				quad.dim = 1 - t;
				if ( t === 1 ) {
					quad.a = null;
				}
				return;
			}
			quad.clip = false;
			// The image of the lightbox once it is open: asked for then, it
			// is asked for at the size it is drawn at, not smaller on the
			// way. Until its texture is there, the one of the slide; and
			// where the page has none, as a slide of a stack that waits.
			quad.media = t === 1 || ! had ? it.media : null;
		};

		// Measures where the view of the slider is on the screen.
		const measure = () => {
			const r = root.getBoundingClientRect();
			screen = {
				x: -r.left - root.clientLeft,
				y: -r.top - root.clientTop,
				w: dialog!.clientWidth,
				h: dialog!.clientHeight,
			};
		};

		// The canvas of the slider goes into the lightbox, or back.
		const lift = ( on: boolean ) => {
			if ( outer ) {
				outer.lift = on ? dialog : null;
				outer.change = on ? grow : null;
				slider.wake();
			}
		};

		// First plugin of the slider in the lightbox: moves `t`, and has
		// the canvas draw when the lightbox has moved.
		const driver = () => ( {
			frame( _view, dt, now ) {
				since ||= now;
				if ( ! started ) {
					// Without a canvas the lightbox fades in: not before a
					// first frame of it.
					started = !! outer || now - since > 50;
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
				dialog!.style.setProperty( '--gs-open', t.toFixed( 3 ) );
				// The arrows go from the slider to the sides of the screen.
				arrows.forEach( ( [ from, arrow ] ) => {
					const a = from.getBoundingClientRect();
					const u = 1 - t;
					arrow.style.transform = `translate(${ ( a.x - arrow.offsetLeft ) * u }px,${
						( a.y - arrow.offsetTop ) * u
					}px) scale(${ 1 + ( a.width / arrow.offsetWidth - 1 ) * u })`;
				} );
				// The images of the lightbox, where no canvas draws them.
				dialog!.style.setProperty( '--gs-shown', ( outer ? 0 : t.toFixed( 3 ) ) as string );
				if ( outer ) {
					if ( screen.w !== dialog!.clientWidth || screen.h !== dialog!.clientHeight ) {
						measure();
					}
					slider.wake();
				}
				if ( started && to === 0 && t === 0 ) {
					// After this frame: the slider is still drawing.
					win.setTimeout( finish, 0 );
				}
			},
			busy: () => ! started || t !== to,
		} ) satisfies Plugin;

		function build() {
			dialog = doc.createElement( 'dialog' );
			dialog.className = 'gs-lightbox';
			dialog.setAttribute( 'aria-label', labels.dialog || 'Image viewer' );
			const button = ( name: string, label: string ) =>
				`<button type="button" class="gs-button gs-${ name }" data-gs-${ name } aria-label="${ label }"></button>`;
			dialog.innerHTML =
				'<div class="gs gs-box"><div class="gs-track"></div>' +
				button( 'close', labels.close || 'Close' ) +
				button( 'prev', labels.prev || 'Previous' ) +
				button( 'next', labels.next || 'Next' ) +
				'</div>';
			box = dialog.firstChild as HTMLElement;
			// Escape: the way back is drawn before the dialog closes.
			dialog.addEventListener( 'cancel', ( event ) => {
				event.preventDefault();
				hide();
			} );
			dialog.addEventListener( 'click', ( event ) => {
				if ( ( event.target as Element ).closest( '[data-gs-close]' ) ) {
					hide();
					return;
				}
				if ( ( event.target as Element ).closest( 'button' ) || ! shown ) {
					return;
				}
				// Next to the image, not on it.
				const media = shown.slides[ shown.index ].firstChild as Media;
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

		function show( item: number, byPointer = false ) {
			if ( shown || ! items[ item ] ) {
				return;
			}
			pointed = byPointer;
			if ( ! dialog ) {
				build();
			}
			const track = box.firstChild as HTMLElement;
			track.replaceChildren(
				...items.map( ( { _media: media }, k ) => {
					const slide = doc.createElement( 'div' );
					slide.className = 'gs-slide';
					const copy = media.cloneNode() as Media;
					copy.className = 'gs-media';
					// The image that opens first; the others as they come near.
					copy.loading = k - item ? 'lazy' : 'eager';
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
			dialog!.showModal();
			t = 0;
			to = 1;
			speed = 0;
			started = false;
			since = 0;
			active = item;
			outer = layerOf( slider );
			outer = outer?.canvas ? outer : null;
			dialog!.style.setProperty( '--gs-open', 0 as unknown as string );
			dialog!.style.setProperty( '--gs-shown', 0 as unknown as string );
			// Arrows of the slider that are seen: they are the ones of the
			// lightbox meanwhile.
			arrows = [ 'prev', 'next' ].flatMap( ( kind ): [ HTMLElement, HTMLElement ][] => {
				const from = slider.plugins.controls
					?.elements( kind )
					.find( ( el: HTMLButtonElement ) => el.offsetWidth && ! el.disabled );
				const arrow = box.querySelector< HTMLElement >( `.gs-${ kind }` )!;
				if ( ! from ) {
					return [];
				}
				from.style.visibility = 'hidden';
				arrow.style.opacity = 1 as unknown as string;
				return [ [ from, arrow ] ];
			} );
			shown = createSlider( box, {
				loop: slider.layout().loop && items.length > 2,
				...inner,
				perView: 1,
				gap: 0,
				start: item,
				plugins: [ driver, controls(), keyboard() ],
			} );
			if ( outer ) {
				measure();
				lift( true );
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
			arrows.forEach( ( [ from, arrow ] ) => {
				from.style.visibility = '';
				arrow.removeAttribute( 'style' );
			} );
			arrows = [];
			shown.destroy();
			shown = null;
			( box.firstChild as HTMLElement ).replaceChildren();
			dialog!.close();
			const back = doc.activeElement as HTMLElement;
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
			const zoom = ( event.target as Element ).closest( '[data-gs-zoom]' );
			if (
				! event.defaultPrevented &&
				( zoom || ! ( event.target as Element ).closest( NOT_A_CLICK ) )
			) {
				show(
					of[ index ],
					// A click of the keys has no count of clicks.
					event.detail > 0
				);
			}
		} );
		root.classList.add( 'gs-zooms' );
		// Enter on the slider opens its slide, as a click does.
		root.addEventListener(
			'keydown',
			( event ) =>
				event.key === 'Enter' &&
				event.target === root &&
				show( of[ slider.index ] ),
			{ signal: slider.signal }
		);

		return {
			name: 'lightbox',
			slides: read,

			/**
			 * @param index Slide to open the lightbox with.
			 */
			open: ( index: number ) => show( of[ index ] ),
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
		} satisfies Plugin;
	};
}
