/**
 * Slides on top of each other, for transitions.
 *
 * Nothing moves. The two slides around the position are shown, the later
 * one on top. How they follow each other is up to the page or the canvas:
 *
 *     --ss-near    1 on its place, 0 one slide away: the content of the
 *                  slides fades by it
 *     --ss-cover   the same for the slide that comes in, 1 for the one
 *                  below, so that nothing behind the two shines through
 *
 * The canvas draws a transition instead (see `gl/transitions/`).
 */

export function stack() {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, slides } = slider;
		let shown = [];
		root.classList.add( 'ss-stack' );

		const clear = () => {
			shown = [];
			slides.forEach( ( { style } ) => {
				style.visibility = '';
				style.zIndex = '';
				style.removeProperty( '--ss-near' );
				style.removeProperty( '--ss-cover' );
			} );
		};

		return {
			name: 'stack',
			slides: clear,

			// Every slide is as wide as the view, and one view from the next.
			layout( measured ) {
				const { span: width, left } = measured;
				measured.stack = true;
				measured.gap = 0;
				measured.size = left.map( () => width );
				measured.left = left.map( ( _, i ) => i * width );
			},

			frame( { places } ) {
				places.forEach( ( { p }, i ) => {
					const near =
						Math.round( Math.max( 0, 1 - Math.abs( p ) ) * 1000 ) / 1000;
					if ( near !== shown[ i ] ) {
						shown[ i ] = near;
						const { style } = slides[ i ];
						style.visibility = near ? '' : 'hidden';
						style.zIndex = p > 0 ? '1' : '0';
						style.setProperty( '--ss-near', String( near ) );
						style.setProperty( '--ss-cover', String( p > 0 ? near : 1 ) );
					}
				} );
			},

			destroy() {
				clear();
				root.classList.remove( 'ss-stack' );
			},
		};
	};
}
