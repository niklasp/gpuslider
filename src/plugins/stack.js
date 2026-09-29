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
 *
 * A page may say `class="ss ss-stack"` in its HTML. Then the slides are on
 * top of each other before the script is there, and nothing of the page
 * gives way when it comes; without the script the first slide is what is
 * seen.
 */

export function stack() {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, slides } = slider;
		let shown = [];
		// What the page has said stays when the slider ends.
		const said = root.classList.contains( 'ss-stack' );
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
						// Said, not left to the page: until it is said, the
						// first slide is the one that is seen.
						style.visibility = near ? 'visible' : 'hidden';
						style.zIndex = p > 0 ? '1' : '0';
						style.setProperty( '--ss-near', String( near ) );
						style.setProperty( '--ss-cover', String( p > 0 ? near : 1 ) );
					}
				} );
			},

			destroy() {
				clear();
				if ( ! said ) {
					root.classList.remove( 'ss-stack' );
				}
			},
		};
	};
}
