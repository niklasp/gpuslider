/**
 * Animations in CSS: tells every slide where it is, as custom properties,
 * on every frame of a move.
 *
 *     --ss-p       how far the slide is from its resting place, in slides:
 *                  -1 is one slide before the active one, 1 one after
 *     --ss-away    the same without a sign and not more than `range`
 *     --ss-share   how much of the slide is in the view, 0 to 1
 *
 * What to do with them is up to the page. What moves is what is in the
 * slide, not the slide: that one the slider moves and measures.
 *
 *     .ss-slide {
 *         perspective: 1200px;
 *         opacity: calc( 1 - var(--ss-away) * 0.6 );
 *     }
 *     .ss-slide > * {
 *         scale: calc( 1 - var(--ss-away) * 0.2 );
 *         rotate: y calc( var(--ss-p) * 30deg );
 *     }
 *
 * This styles the slides of the page. What the canvas draws of them is
 * changed by effects (see `gl/`), `coverflow()` for one.
 *
 *     createSlider( element, { plugins: [ progress() ] } );
 */

/**
 * @param {Object} [options]       Options.
 * @param {number} [options.range] Slides further away than this are as far
 *                                 away as this.
 */
export function progress( { range = 1 } = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		// What each slide was told last: three decimals are all that shows.
		let told = [];
		const round = ( value ) => Math.round( value * 1000 ) / 1000;

		return {
			name: 'progress',

			slides() {
				told = [];
			},

			frame( { places } ) {
				places.forEach( ( { el, p, share }, i ) => {
					const values = [
						round( p ),
						round( Math.min( range, Math.abs( p ) ) ),
						round( share ),
					];
					const key = values.join();
					if ( key !== told[ i ] ) {
						told[ i ] = key;
						el.style.setProperty( '--ss-p', values[ 0 ] );
						el.style.setProperty( '--ss-away', values[ 1 ] );
						el.style.setProperty( '--ss-share', values[ 2 ] );
					}
				} );
			},

			destroy() {
				slider.slides.forEach( ( { style } ) => {
					style.removeProperty( '--ss-p' );
					style.removeProperty( '--ss-away' );
					style.removeProperty( '--ss-share' );
				} );
			},
		};
	};
}
