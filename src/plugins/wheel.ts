/**
 * Scrolling along the way of the slides, by a trackpad or a wheel: the
 * slider follows and comes to rest when the scrolling stops.
 *
 * The listener is not passive: it has to keep the browser from going back
 * in its history, and the page from scrolling under a slider that goes
 * down. At the ends of such a slider the page scrolls on.
 */

import type { Plugin, Slider } from '../index.js';

// A wheel or trackpad has stopped when it is silent for this long, ms.
const SILENCE = 90;

export function wheel() {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { root, win, motion } = slider;
		let rolling = 0;
		let rolled = 0;
		let from = 0;

		root.addEventListener(
			'wheel',
			( event ) => {
				const { y, rtl } = slider.layout();
				const by = y ? event.deltaY : event.deltaX;
				if (
					// A pointer has it.
					( motion.dragging && ! rolling ) ||
					Math.abs( by ) <=
						Math.abs( y ? event.deltaX : event.deltaY ) ||
					( y && ! rolling && ! ( by > 0 ? slider.canNext : slider.canPrev ) )
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
					( rtl ? -1 : 1 ) *
					by *
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
		} satisfies Plugin;
	};
}
