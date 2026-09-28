/**
 * The slider runs by itself, evenly and without an end: a ticker.
 *
 * For a slider that loops, best one that may rest anywhere (`free`). A
 * visitor can still drag it; let go, it runs on.
 *
 *     marquee( { speed: 60 } )
 *
 * It stands still while the slider is not on the screen, for visitors who
 * ask for less motion, and when it is told to: by `pause()`, or by a
 * `<button data-ss-pause>` (see `autoplay`).
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
 * @param {number} [options.scroll] How much of the speed the page scrolls
 *                                  with is added, and told to the effects
 *                                  of the canvas as the speed of the
 *                                  slider. 0 for none.
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
		let paused = false;
		// Where the page was scrolled to, and how fast it scrolls.
		let was = win.scrollY;
		let pace = 0;

		const running = () =>
			seen && ! paused && ! still.matches && ! doc.hidden;

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
		doc.addEventListener( 'visibilitychange', slider.wake, { signal } );
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
				if ( ! running() ) {
					return;
				}
				const now = win.scrollY;
				pace += ( ( now - was ) / dt - pace ) * ( 1 - Math.exp( -8 * dt ) );
				was = now;
				const more = Math.abs( pace ) < 1 ? 0 : pace * scroll;
				if ( ! motion.dragging ) {
					slider.shift(
						( speed * ( over ? hover : 1 ) +
							Math.sign( speed ) * Math.abs( more ) ) *
							dt
					);
				}
				if ( more ) {
					motion.smooth = Math.sign( speed ) * Math.abs( more );
				}
			},

			busy: running,
			destroy: unwatch,
		};
	};
}
