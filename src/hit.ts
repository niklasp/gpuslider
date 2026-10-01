/**
 * Which slide is seen at a point of the page.
 *
 * The page takes a click where the slide is; the canvas draws the slide
 * where its effects put it. With effects that lay the slides out (covers
 * that turn away, a pile, a fan, a dome, a row that bends) the two are not
 * the same place: what is seen at the edge of the slider is a slide whose
 * place on the page is somewhere else, or out of view.
 *
 * `canvas()` brings this plugin when one of its effects moves the mesh and
 * says so in JS (`place`, see `gl/program.js`). With a layer by its name:
 *
 *     import { gl, hit, coverflow } from 'gpuslider/gl';
 *
 *     const effects = [ coverflow() ];
 *     createSlider( element, { plugins: [ gl( { effects } ), hit( { effects } ) ] } );
 *
 * Then `click` says the slide that is seen under the pointer, and the
 * lightbox lets the image grow out of where it is drawn.
 */

import type { Effect } from './gl/program.js';
import type { Plugin, Slider } from './index.js';

// Squares per side of what stands for the mesh of a slide.
const GRID = 8;

/**
 * @param options The options of the canvas.
 * @param options.effects Its
 *                                       effects.
 * @param options.perspective Distance of the eye, px.
 */
export function hit( { effects = [], perspective = 1200 }: { effects?: Effect[]; perspective?: number } = {} ) {
	const movers = effects.filter( ( effect ) => effect.place );
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { root, slides } = slider;

		/**
		 * Where the root is on the page, and how much larger than it is
		 * laid out: what is measured here is measured in the root, as the
		 * canvas has it.
		 *
		 * @return Left, top, scale.
		 */
		const page = (): number[] => {
			const around = root.getBoundingClientRect();
			const scale = around.width / root.offsetWidth || 1;
			return [
				around.left + root.clientLeft * scale,
				around.top + root.clientTop * scale,
				scale,
			];
		};

		/**
		 * The mesh of a quad as the canvas draws it. Reads nothing of the
		 * page: it is asked in every frame.
		 *
		 * @param x Where the page has the quad, in the root.
		 * @param y The same from the top.
		 * @param w Its width.
		 * @param h Its height.
		 * @param progress How far its slide is from its place.
		 * @return For every point x and y in the root and how
		 *         far it is from the eye.
		 */
		const grid = ( x: number, y: number, w: number, h: number, progress: number ): number[] => {
			const { width, height, y: down, rtl } = slider.layout();
			// Effects have the way of the slides as their x.
			const turn = ( a: number, b: number ) => ( down ? [ b, a ] : [ a, b ] );
			const at = turn( x, y );
			const size = turn( w, h );
			const view = turn( width, height );
			const about = {
				progress,
				velocity: ( rtl ? 1 : -1 ) * slider.view.velocity,
				size,
				view,
				quad: [ ...at, ...size ],
			};
			const points: number[] = [];
			for ( let row = 0; row <= GRID; row++ ) {
				for ( let column = 0; column <= GRID; column++ ) {
					const uv = turn( column / GRID, row / GRID );
					let p = [
						( uv[ 0 ] - 0.5 ) * size[ 0 ],
						( uv[ 1 ] - 0.5 ) * size[ 1 ],
						0,
					];
					movers.forEach( ( { place } ) => {
						p = place!( p, about, uv ) || p;
					} );
					const far = 1 - p[ 2 ] / perspective;
					points.push(
						...turn(
							...( [ 0, 1 ].map(
								( k ) =>
									( at[ k ] + size[ k ] / 2 + p[ k ] - view[ k ] / 2 ) /
										far +
									view[ k ] / 2
							) as [ number, number ] )
						),
						-p[ 2 ] / far
					);
				}
			}
			return points;
		};

		/**
		 * The mesh of a slide as the canvas draws it.
		 *
		 * @param i Slide.
		 * @param from Where the root is, see `page()`.
		 * @return As `grid()`; null when the canvas does
		 *         not draw the slide.
		 */
		const mesh = ( i: number, [ left, top, scale ]: number[] ): number[] | null => {
			const media = slides[ i ].querySelector( '.gs-media' );
			const layer = slider.plugins.gpu || slider.plugins.gl;
			if ( ! media || ! layer?.shows( media ) ) {
				return null;
			}
			const box = media.getBoundingClientRect();
			return grid(
				( box.left - left ) / scale,
				( box.top - top ) / scale,
				box.width / scale,
				box.height / scale,
				slider.view.places[ i ].p
			);
		};

		/**
		 * The point of a mesh that is at a point of the root, or the one
		 * that would be there if the mesh went on past its edge.
		 *
		 * @param points As `grid()`.
		 * @param x In the root.
		 * @param y The same from the top.
		 * @return How far the point is out of the mesh, 0 when
		 *         it is in it; how far from the eye; where in
		 *         the quad, 0 to 1 across and down.
		 */
		const find = ( points: number[], x: number, y: number ): number[] => {
			let found = [ Infinity ];
			for ( let k = 0; k < GRID * GRID * 2; k++ ) {
				const row = Math.floor( k / 2 / GRID );
				const column = ( k >> 1 ) % GRID;
				// The two halves of a square: its corners are three
				// numbers each, row after row.
				const half = k % 2;
				const first = 3 * ( row * ( GRID + 1 ) + column );
				const a = first + 3 * half;
				const b = first + 3 * ( GRID + 1 );
				const c = half ? b + 3 : first + 3;
				const bx = points[ b ] - points[ a ];
				const by = points[ b + 1 ] - points[ a + 1 ];
				const cx = points[ c ] - points[ a ];
				const cy = points[ c + 1 ] - points[ a + 1 ];
				const area = bx * cy - cx * by;
				const u = ( ( x - points[ a ] ) * cy - cx * ( y - points[ a + 1 ] ) ) / area;
				const v = ( bx * ( y - points[ a + 1 ] ) - ( x - points[ a ] ) * by ) / area;
				const out = Math.max( -u, -v, u + v - 1, 0 );
				const far =
					points[ a + 2 ] +
					u * ( points[ b + 2 ] - points[ a + 2 ] ) +
					v * ( points[ c + 2 ] - points[ a + 2 ] );
				// Of what is there the nearest, as the canvas has it.
				if ( out < found[ 0 ] || ( ! out && far < found[ 1 ] ) ) {
					found = [
						out,
						far,
						( column + ( half ? 1 - u : v ) ) / GRID,
						( row + u + half * v ) / GRID,
					];
				}
			}
			return found;
		};

		return {
			name: 'hit',

			/**
			 * @param x On the page, as `clientX` of an event.
			 * @param y As `clientY`.
			 * @return The slide that is seen there, -1
			 *         for none; nothing when the page
			 *         draws the slides.
			 */
			at( x: number, y: number ): number | undefined {
				let found: number | undefined;
				let nearest = Infinity;
				const from = page();
				slides.forEach( ( _, i ) => {
					const points = mesh( i, from );
					if ( ! points ) {
						return;
					}
					found ??= -1;
					const [ out, far ] = find(
						points,
						( x - from[ 0 ] ) / from[ 2 ],
						( y - from[ 1 ] ) / from[ 2 ]
					);
					// As the canvas: what is drawn later is on top of what
					// is as far.
					if ( ! out && far <= nearest + 0.001 ) {
						nearest = far;
						found = i;
					}
				} );
				return found;
			},

			/**
			 * Where the pointer is in a quad as it is drawn: the layers ask
			 * for their effects that follow the pointer.
			 *
			 * @param x Where the page has the quad, in the
			 *          root.
			 * @param y The same from the top.
			 * @param w Its width.
			 * @param h Its height.
			 * @param progress How far its slide is from its place.
			 * @param pointer The
			 *                          pointer in the root.
			 * @return Across and down, 0 to 1 in the
			 *                          quad and past that out of it; nothing
			 *                          while no pointer is there.
			 */
			uv( x: number, y: number, w: number, h: number, progress: number, pointer: { x: number; y: number; in: number } ): number[] | undefined {
				return pointer.in
					? find( grid( x, y, w, h, progress ), pointer.x, pointer.y ).slice( 2 )
					: undefined;
			},

			/**
			 * @param i Slide.
			 *         What is around the slide as it is drawn, on the page;
			 *         null when the canvas does not draw it.
			 */
			where( i: number ): { left: number; top: number; width: number; height: number }|null {
				const from = page();
				const points = mesh( i, from );
				if ( ! points ) {
					return null;
				}
				const [ left, right, top, bottom ] = [ 0, 1 ].flatMap( ( k ) => {
					const all = points.filter( ( _, n ) => n % 3 === k );
					return [ Math.min( ...all ), Math.max( ...all ) ].map(
						( at ) => from[ k ] + at * from[ 2 ]
					);
				} );
				return {
					left,
					top,
					width: right - left,
					height: bottom - top,
				};
			},
		} satisfies Plugin;
	};
}
