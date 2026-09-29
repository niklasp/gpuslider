/**
 * The slider runs by itself, evenly and without an end: a ticker.
 *
 * For a slider that loops (another one stands still), best one that may
 * rest anywhere (`free`). A visitor can still drag it; let go, it runs on.
 *
 *     marquee( { speed: 60 } )
 *
 * With `scroll` it runs faster while the page is scrolled, and the effects
 * of the canvas see that as speed of the slider: pictures that stretch
 * with the scrolling.
 *
 * While it runs the slider is at no slide: its `index` is the one it was
 * at last, and it tells no `change`.
 *
 * It stands still while the slider is not on the screen, while the focus
 * of the keys is in it, for visitors who ask for less motion, and when it
 * is told to: by `pause()`, or by a
 * `<button data-gs-pause>` (see `autoplay`).
 *
 * Events of the slider: `marquee:play`, `marquee:pause`.
 */
import { elements } from './elements.js';
import { onScreen } from './screen.js';

/**
 * @param {Object} [options]        Options.
 * @param {number} [options.speed]  px per second; negative runs the other
 *                                  way.
 * @param {number} [options.hover]  What is left of the speed while a
 *                                  pointer is over the slider: 0 stops it.
 * @param {number} [options.scroll] How much of the speed the page is
 *                                  scrolled with is added, whichever way
 *                                  it is scrolled. 0 for none.
 * @param {import('./elements.js').Elements} [options.pause] Buttons that
 *                                  stop it.
 */
export function marquee( { speed = 40, hover = 1, scroll = 0, pause } = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, win, motion, signal } = slider;
		const doc = root.ownerDocument;
		const { all } = elements( slider, { pause } );
		const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
		let seen = true;
		let over = false;
		// The focus of the keys is in it: it stands, so what has the focus
		// stays in view.
		let held = false;
		let paused = false;
		// Where the page was scrolled to, and how fast it is scrolled.
		let was = win.scrollY;
		let pace = 0;
		// What is left of the speed: eased, for the pointer over the slider.
		let rate = 1;

		const running = () =>
			seen &&
			! held &&
			! paused &&
			! still.matches &&
			! doc.hidden &&
			slider.layout().loop;

		const show = () =>
			all( 'pause' ).forEach( ( el ) =>
				el.setAttribute( 'aria-pressed', String( paused ) )
			);
		const stop = ( on ) => {
			if ( on !== paused ) {
				paused = on;
				show();
				slider.wake();
				slider.emit( on ? 'marquee:pause' : 'marquee:play' );
			}
		};

		const unwatch = onScreen( slider, ( on ) => {
			seen = on;
			slider.wake();
		} );
		root.addEventListener( 'pointerenter', () => ( over = true ), { signal } );
		root.addEventListener( 'pointerleave', () => ( over = false ), { signal } );
		[ 'focusin', 'focusout' ].forEach( ( name, i ) =>
			root.addEventListener(
				name,
				( { target } ) => {
					held = ! i && target.matches( ':focus-visible' );
					slider.wake();
				},
				{ signal }
			)
		);
		doc.addEventListener( 'visibilitychange', slider.wake, { signal } );
		still.addEventListener( 'change', slider.wake, { signal } );
		doc.addEventListener(
			'click',
			( { target } ) =>
				all( 'pause' ).some( ( el ) => el.contains( target ) ) &&
				stop( ! paused ),
			{ signal }
		);

		return {
			name: 'marquee',
			measure: show,

			/** Whether it is stopped by `pause()`. */
			get paused() {
				return paused;
			},
			/** Stops until `play()`. */
			pause: () => stop( true ),
			/** Runs on. */
			play: () => stop( false ),

			frame( view, dt ) {
				const now = win.scrollY;
				const ease = 1 - Math.exp( -8 * dt );
				pace += ( Math.abs( now - was ) / dt - pace ) * ease;
				was = now;
				if ( running() && ! motion.dragging ) {
					const way = Math.sign( speed );
					rate += ( ( over ? hover : 1 ) - rate ) * ease;
					slider.shift( speed * rate * dt );
					if ( pace * scroll > 1 ) {
						slider.shift( way * pace * scroll * dt, true );
					}
				}
			},

			busy: running,
			destroy: unwatch,
		};
	};
}
