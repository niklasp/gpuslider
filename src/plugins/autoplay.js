/**
 * Goes on by itself.
 *
 * Waits while the visitor points at the slider or has the focus of the
 * keys in it, while the slider is not on the screen and while the tab is
 * hidden. With
 * `hover: false` it does not wait for the pointer: for a slider that is
 * most of the screen, which the pointer is always over.
 *
 *     autoplay( 3500 )
 *     autoplay( { delay: 3500, pause: '.my-pause', hover: false } )
 *
 * `left` is the time the slide it begins on has left, ms: for a slider
 * made again, that goes on as if it had not been.
 *
 * Buttons that stop it: `<button data-gs-pause>` in the slider or, with the
 * id of the slider, anywhere; or handed over as `pause`.
 *
 * Events of the slider: `autoplay:play`, `autoplay:pause`; and
 * `autoplay:run` with `{ delay, left }` when the time of a slide begins
 * to run (`left` of `delay`),
 * `autoplay:wait` when it stops before its end. With both, a page can
 * show how long a slide has left.
 */
import { elements } from './elements.js';
import { onScreen } from './screen.js';

/**
 * @param {number | { delay?: number, pause?: import('./elements.js').Elements, hover?: boolean, left?: number }} [options]
 *        Time a slide stays, ms; or that as `delay`, buttons that stop it
 *        as `pause`, `hover: false` for not waiting for the pointer, and
 *        the time the first slide has `left`.
 */
export function autoplay( options = {} ) {
	let { delay = 4000, pause, hover = true, left } =
		typeof options === 'number' ? { delay: options } : options;

	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, win, signal, track } = slider;
		const doc = root.ownerDocument;
		const { all } = elements( slider, { pause } );
		let timer = 0;
		let seen = true;
		let held = false;
		let paused = false;

		const wait = () => {
			if ( timer ) {
				win.clearTimeout( timer );
				timer = 0;
				slider.emit( 'autoplay:wait' );
			}
		};
		const schedule = () => {
			wait();
			if (
				seen &&
				! held &&
				! paused &&
				! doc.hidden &&
				! slider.motion.dragging
			) {
				const time = left ?? delay;
				timer = win.setTimeout( () => {
					timer = 0;
					slider.canNext ? slider.next() : slider.to( 0 );
				}, time );
				slider.emit( 'autoplay:run', { delay, left: time } );
			}
			// Slides that change by themselves are not read out.
			track.ariaLive = timer ? 'off' : 'polite';
		};

		const show = () =>
			all( 'pause' ).forEach( ( el ) =>
				el.setAttribute( 'aria-pressed', String( paused ) )
			);
		const stop = ( on ) => {
			if ( on !== paused ) {
				paused = on;
				schedule();
				show();
				slider.emit( on ? 'autoplay:pause' : 'autoplay:play' );
			}
		};

		// Another slide has all the time.
		slider.on( 'change', () => {
			left = undefined;
			wait();
		} );
		slider.on( 'dragstart', wait );
		slider.on( 'settle', schedule );
		const unwatch = onScreen( slider, ( on ) => {
			seen = on;
			schedule();
		} );
		[ 'pointerenter', 'pointerleave', 'focusin', 'focusout' ].forEach(
			( name, i ) =>
				root.addEventListener(
					name,
					( event ) => {
						// Pointers are the first two, the focus the others: the
						// focus of the keys, not the one a press leaves.
						if ( event.pointerType !== 'touch' && ( hover || i > 1 ) ) {
							held =
								i % 2 === 0 &&
								( i < 2 || event.target.matches( ':focus-visible' ) );
							schedule();
						}
					},
					{ signal }
				)
		);
		doc.addEventListener( 'visibilitychange', schedule, { signal } );
		doc.addEventListener(
			'click',
			( { target } ) =>
				all( 'pause' ).some( ( el ) => el.contains( target ) ) &&
				stop( ! paused ),
			{ signal }
		);
		schedule();

		return {
			name: 'autoplay',
			measure: show,

			/** Whether it is stopped by `pause()`. */
			get paused() {
				return paused;
			},
			/** Stops until `play()`. */
			pause: () => stop( true ),
			/** Goes on. */
			play: () => stop( false ),

			destroy() {
				wait();
				unwatch();
			},
		};
	};
}
