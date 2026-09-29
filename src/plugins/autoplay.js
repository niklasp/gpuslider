/**
 * Goes on by itself.
 *
 * Waits while the visitor points at the slider or has the focus in it,
 * while the slider is not on the screen and while the tab is hidden.
 *
 *     autoplay( 3500 )
 *     autoplay( { delay: 3500, pause: '.my-pause' } )
 *
 * Buttons that stop it: `<button data-gs-pause>` in the slider or, with the
 * id of the slider, anywhere; or handed over as `pause`.
 *
 * Events of the slider: `autoplay:play`, `autoplay:pause`.
 */
import { elements } from './elements.js';
import { onScreen } from './screen.js';

/**
 * @param {number | { delay?: number, pause?: import('./elements.js').Elements }} [options]
 *        Time a slide stays, ms; or that as `delay`, and buttons that stop
 *        it as `pause`.
 */
export function autoplay( options = {} ) {
	const { delay = 4000, pause } =
		typeof options === 'number' ? { delay: options } : options;

	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, win, signal } = slider;
		const doc = root.ownerDocument;
		const { all } = elements( slider, { pause } );
		let timer = 0;
		let seen = true;
		let held = false;
		let paused = false;

		const wait = () => win.clearTimeout( timer );
		const schedule = () => {
			wait();
			if (
				seen &&
				! held &&
				! paused &&
				! doc.hidden &&
				! slider.motion.dragging
			) {
				timer = win.setTimeout(
					() => ( slider.canNext ? slider.next() : slider.to( 0 ) ),
					delay
				);
			}
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

		slider.on( 'change', wait );
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
						if ( event.pointerType !== 'touch' ) {
							held = i % 2 === 0;
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
