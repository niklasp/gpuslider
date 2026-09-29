/**
 * Slides on top of each other, for transitions.
 *
 * Nothing moves. The two slides around the position are shown, the later
 * one on top. How they follow each other is up to the page or the canvas:
 *
 *     --gs-near    1 on its place, 0 one slide away: the content of the
 *                  slides fades by it
 *     --gs-cover   the same for the slide that comes in, 1 for the one
 *                  below, so that nothing behind the two shines through
 *
 * The canvas draws a transition instead (see `gl/transitions/`).
 *
 * The media of the slide that is shown come first. Images that wait for
 * their place (`loading="lazy"`) would not wait in a stack, where every
 * slide is in the place of the first: so the slides next to the one that
 * is shown are kept from the page until its images are there, and the
 * others until they are next. A film waits when it says `preload="none"`.
 *
 * A page may say `class="gs gs-stack"` in its HTML. Then the slides are on
 * top of each other before the script is there, and nothing of the page
 * gives way when it comes; without the script the first slide is what is
 * seen.
 */

export function stack() {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, slides } = slider;
		let shown = [];
		// Slides that are kept from the page, and whether the images of
		// the slide that is shown are there.
		let kept = [];
		let there = false;
		// What the page has said stays when the slider ends.
		const said = root.classList.contains( 'gs-stack' );
		root.classList.add( 'gs-stack' );

		const clear = () => {
			shown = [];
			kept = [];
			slides.forEach( ( { style } ) => {
				style.visibility = '';
				style.contentVisibility = '';
				style.zIndex = '';
				style.removeProperty( '--gs-near' );
				style.removeProperty( '--gs-cover' );
			} );
		};

		// An image that has come may be the one that was waited for.
		root.addEventListener( 'load', () => there || slider.wake(), {
			capture: true,
			signal: slider.signal,
		} );

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
				there ||= places.every(
					( { p }, i ) =>
						Math.abs( p ) >= 1 ||
						[ ...slides[ i ].querySelectorAll( 'img' ) ].every(
							( image ) => image.complete
						)
				);
				places.forEach( ( { p }, i ) => {
					const near =
						Math.round( Math.max( 0, 1 - Math.abs( p ) ) * 1000 ) / 1000;
					const { style } = slides[ i ];
					const keep = ! near && ( ! there || Math.abs( p ) > 1.5 );
					if ( keep !== kept[ i ] ) {
						kept[ i ] = keep;
						style.contentVisibility = keep ? 'hidden' : 'visible';
					}
					if ( near !== shown[ i ] ) {
						shown[ i ] = near;
						// Said, not left to the page: until it is said, the
						// first slide is the one that is seen.
						style.visibility = near ? 'visible' : 'hidden';
						style.zIndex = p > 0 ? '1' : '0';
						style.setProperty( '--gs-near', String( near ) );
						style.setProperty( '--gs-cover', String( p > 0 ? near : 1 ) );
					}
				} );
			},

			destroy() {
				clear();
				if ( ! said ) {
					root.classList.remove( 'gs-stack' );
				}
			},
		};
	};
}
