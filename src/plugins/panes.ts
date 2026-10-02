import type { Plugin, Slider } from '../index.js';

/**
 * Several slides in view that stay where they are: each place turns its
 * slide into the one that comes next to it, one place after another.
 *
 * The slides of the page are laid out as they always are, `--gs-per-view`
 * of them in view. The first that many are the first view, the next that
 * many the next: a move goes from view to view, and each place, a pane,
 * turns its picture into its next with the transition of the canvas,
 * which is any there is (see `gl/transitions/`). Without a canvas the
 * pictures fade, place after place.
 *
 *     createSlider( element, {
 *         perView: 3,
 *         plugins: [ panes( { order: 'center' } ), canvas( { effects: [ burn() ] } ) ],
 *     } );
 *
 * `order` is the one in which the places turn: `start`, from the first on
 * (on the left, or on the right of a page that is read from the right),
 * `end`, `center`, from the middle out, or `random`, another one for each
 * move. `stagger` is how much of the move lies between the first place
 * and the last, 0 to 1: at 0 all turn at once. Both can change while the
 * slider runs: `slider.plugins.panes.order = 'random'`. The time of a
 * move is the `duration` of the slider; with `ease: ( u ) => u` every
 * place has as long to turn as the others.
 *
 * As with `stack()`: `--gs-near` is 1 on a slide that is shown and 0 on
 * one that is not, for its content, and `--gs-cover` the same for the
 * picture of the slide that comes in. A whole number of slides per view
 * makes whole views: the places of a last view that has fewer are empty.
 *
 * @param options Options.
 * @param options.order Which
 *        place turns first.
 * @param options.stagger How
 *        much of a move lies between the first place and the last, 0 to 1.
 */
export function panes( { order = 'start', stagger = 0.6 }: { order?: 'start' | 'end' | 'center' | 'random'; stagger?: number } = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { root, slides, view } = slider;
		// Places in view, views, and how far each slide is moved to its
		// place; and where each place is, from the start of the track.
		let n = 1;
		let views = 1;
		let moved: number[] = [];
		let at: number[] = [];
		const shown: number[] = [];
		root.classList.add( 'gs-panes' );

		const clear = () => {
			moved = [];
			shown.length = 0;
			slides.forEach( ( { style } ) => {
				style.translate = style.visibility = style.zIndex = '';
				style.removeProperty( '--gs-near' );
				style.removeProperty( '--gs-cover' );
			} );
		};

		// The place of a slide, and its view.
		const pane = ( i: number ) => i % n;
		const page = ( i: number ) => Math.floor( i / n );

		/**
		 * How far the place of a slide has turned, 0 to 1: from the view
		 * the slider has passed to the one it moves to.
		 *
		 * @param i Slide.
		 * @return 0 to 1.
		 */
		const mix = ( i: number ): number => {
			const { p } = view.places[ i ];
			const j = pane( i );
			// Not all of the move: the last place needs some of it to turn.
			const spread = Math.min( 0.95, Math.max( 0, plugin.stagger ) );
			// The view it turns from: for `random`, its own order.
			const from = p > 0 ? ( page( i ) - 1 + views ) % views : page( i );
			const rank = ( {
				end: n - 1 - j,
				center: Math.abs( 2 * j - n + 1 ),
				random:
					( n - 1 ) *
					( ( ( Math.sin( from * 78.233 + j * 12.9898 ) * 43758.5453 ) % 1 + 1 ) % 1 ),
			} as Record< string, number > )[ plugin.order ] ?? j;
			const u = Math.min(
				1,
				Math.max(
					0,
					( ( p > 0 ? 1 - p : -p ) - ( n > 1 ? ( rank / ( n - 1 ) ) * spread : 0 ) ) /
						( 1 - spread )
				)
			);
			// Each place begins and ends its turn softly.
			return u * u * ( 3 - 2 * u );
		};

		const plugin = {
			name: 'panes',
			/** Which place turns first. */
			order,
			/** How much of a move lies between the first place and the last. */
			stagger,
			// Other slides: what was laid out was for the ones before, so
			// they are laid out again.
			slides() {
				clear();
				slider.update();
			},
			pane,
			mix,
			/**
			 * @param i Slide.
			 * @return Where its place begins on the screen, from
			 *         the start of the track, px.
			 */
			x: ( i: number ): number => at[ pane( i ) ],

			/**
			 * @return For each place, the slide it turns from
			 *         and the one it turns into (-1 for none), how far, 0
			 *         to 1, where the place begins, px, and one of the two.
			 */
			ends(): number[][] {
				const ends: number[][] = [];
				view.places.forEach( ( { p }, i ) => {
					if ( p > -1 && p < 1 ) {
						( ends[ pane( i ) ] ||= [ -1, -1 ] )[ +( p > 0 ) ] = i;
					}
				} );
				return ends.map( ( [ from, upcoming ] ) => {
					const i = from < 0 ? upcoming : from;
					return [ from, upcoming, mix( i ), at[ pane( i ) ], i ];
				} );
			},

			// Measured as a row; then the slides of a view lie on the
			// places of the first, and the views one view apart.
			layout( measured ) {
				const { span, gap, left, size, rtl, y } = measured;
				const where = left.map( ( l, i ) => l + ( moved[ i ] || 0 ) );
				n = Math.min(
					left.length,
					Math.max( 1, Math.round( ( span + gap ) / ( size[ 0 ] + gap ) ) )
				) || 1;
				views = Math.ceil( left.length / n ) || 1;
				shown.length = 0;
				at = where
					.slice( 0, n )
					.map( ( l, j ) => ( rtl ? span - l + where[ 0 ] - size[ j ] : l - where[ 0 ] ) );
				moved = where.map( ( l, i ) => l - where[ pane( i ) ] );
				slides.forEach( ( { style }, i ) => {
					const by = rtl ? moved[ i ] : -moved[ i ];
					style.translate = y ? `0 ${ by }px` : `${ by }px`;
				} );
				measured.stack = true;
				measured.gap = 0;
				measured.size = left.map( () => span );
				measured.left = left.map( ( _, i ) => page( i ) * span );
			},

			frame( { places } ) {
				places.forEach( ( { p }, i ) => {
					// Shown: the slide the move left, until its place has
					// turned, and the one it moves to, from when it turns.
					const turned = p > -1 && p < 1 ? mix( i ) : 0;
					const near =
						Math.round( ( p > 0 ? turned : p > -1 ? 1 - turned : 0 ) * 1000 ) / 1000;
					if ( near !== shown[ i ] ) {
						shown[ i ] = near;
						const { style } = slides[ i ];
						style.visibility = near ? 'visible' : 'hidden';
						style.zIndex = p > 0 ? '1' : '';
						style.setProperty( '--gs-near', String( near ) );
						style.setProperty( '--gs-cover', String( p > 0 ? near : 1 ) );
					}
				} );
			},

			destroy() {
				clear();
				root.classList.remove( 'gs-panes' );
			},
		} satisfies Plugin;
		return plugin;
	};
}
