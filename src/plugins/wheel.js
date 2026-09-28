/**
 * Sideways scrolling, by a trackpad or a wheel with shift: the slider
 * follows and comes to rest when the scrolling stops.
 *
 * The listener is not passive: it has to keep the browser from going back
 * in its history.
 */

// A wheel or trackpad has stopped when it is silent for this long, ms.
const SILENCE = 90;

export function wheel() {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, win, motion } = slider;
		let rolling = 0;
		let rolled = 0;
		let from = 0;

		root.addEventListener(
			'wheel',
			( event ) => {
				if (
					// A pointer has it.
					( motion.dragging && ! rolling ) ||
					Math.abs( event.deltaX ) <= Math.abs( event.deltaY )
				) {
					return;
				}
				event.preventDefault();
				if ( ! rolling ) {
					from = motion.pos;
					rolled = from;
					slider.grab();
				}
				rolled +=
					( slider.layout().rtl ? -1 : 1 ) *
					event.deltaX *
					// In lines or pages: about as far as in pixels.
					( event.deltaMode ? 40 : 1 );
				slider.drag( rolled );
				win.clearTimeout( rolling );
				rolling = win.setTimeout( () => {
					rolling = 0;
					slider.release( 0, from );
				}, SILENCE );
			},
			{ passive: false, signal: slider.signal }
		);

		return {
			name: 'wheel',
			destroy: () => win.clearTimeout( rolling ),
		};
	};
}
