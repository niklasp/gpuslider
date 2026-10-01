/**
 * The slider is as high as the slides in view.
 *
 * A slide counts by how much of it is in the view, so the height follows
 * the move and never jumps.
 */

import type { Plugin, Slider } from '../index.js';

export function autoHeight() {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { root, track, slides } = slider;
		let tall: number[] = [];
		let most = 0;
		let height = -1;
		root.classList.add( 'gs-tall' );

		return {
			name: 'autoHeight',

			/** Height of the view at its highest, px: what a canvas needs. */
			get most() {
				return most;
			},

			measure() {
				const scale = root.offsetWidth
					? root.getBoundingClientRect().width / root.offsetWidth || 1
					: 1;
				tall = slides.map(
					( slide ) => slide.getBoundingClientRect().height / scale
				);
				// What the slider has around its track stays.
				most =
					root.clientHeight -
					track.offsetHeight +
					Math.max( 0, ...tall );
				height = -1;
			},

			frame( { places } ) {
				let least = Infinity;
				let to = 0;
				places.forEach( ( { share }, i ) => {
					if ( share > 0 ) {
						least = Math.min( least, tall[ i ] );
					}
				} );
				places.forEach( ( { share }, i ) => {
					if ( share > 0 ) {
						to = Math.max( to, least + ( tall[ i ] - least ) * share );
					}
				} );
				to = Math.round( to * 10 ) / 10;
				if ( to !== height ) {
					height = to;
					track.style.height = `${ to }px`;
				}
			},

			destroy() {
				root.classList.remove( 'gs-tall' );
				track.style.height = '';
			},
		} satisfies Plugin;
	};
}
