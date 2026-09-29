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
 *     import { gl, hit, coverflow } from 'shaderslide/gl';
 *
 *     const effects = [ coverflow() ];
 *     createSlider( element, { plugins: [ gl( { effects } ), hit( { effects } ) ] } );
 *
 * Then `click` says the slide that is seen under the pointer, and the
 * lightbox lets the image grow out of where it is drawn.
 */

// Squares per side of what stands for the mesh of a slide.
const GRID = 8;

/**
 * @param {Object} [options]             The options of the canvas.
 * @param {import('./gl/program.js').Effect[]} [options.effects] Its
 *                                       effects.
 * @param {number} [options.perspective] Distance of the eye, px.
 */
export function hit( { effects = [], perspective = 1200 } = {} ) {
	const movers = effects.filter( ( effect ) => effect.place );
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('./index.js').Slider} */ slider ) => {
		const { root, slides } = slider;

		/**
		 * The mesh of a slide as the canvas draws it.
		 *
		 * @param {number} i Slide.
		 * @return {number[] | null} For every point x and y on the page
		 *                           and how far it is from the eye; null
		 *                           when the canvas does not draw the slide.
		 */
		const mesh = ( i ) => {
			const media = slides[ i ].querySelector( '.ss-media' );
			const layer = slider.plugins.gpu || slider.plugins.gl;
			if ( ! media || ! layer?.shows( media ) ) {
				return null;
			}
			const { width, height, y: down, rtl } = slider.layout();
			const { places, velocity } = slider.view;
			const around = root.getBoundingClientRect();
			const scale = around.width / root.offsetWidth || 1;
			const left = around.left + root.clientLeft * scale;
			const top = around.top + root.clientTop * scale;
			const box = media.getBoundingClientRect();
			// Effects have the way of the slides as their x.
			const turn = ( x, y ) => ( down ? [ y, x ] : [ x, y ] );
			const at = turn( ( box.left - left ) / scale, ( box.top - top ) / scale );
			const size = turn( box.width / scale, box.height / scale );
			const view = turn( width, height );
			const about = {
				progress: places[ i ].p,
				velocity: ( rtl ? 1 : -1 ) * velocity,
				size,
				view,
				quad: [ ...at, ...size ],
			};
			const points = [];
			for ( let row = 0; row <= GRID; row++ ) {
				for ( let column = 0; column <= GRID; column++ ) {
					const uv = turn( column / GRID, row / GRID );
					let p = [
						( uv[ 0 ] - 0.5 ) * size[ 0 ],
						( uv[ 1 ] - 0.5 ) * size[ 1 ],
						0,
					];
					movers.forEach( ( { place } ) => {
						p = place( p, about, uv ) || p;
					} );
					const w = 1 - p[ 2 ] / perspective;
					const [ x, y ] = turn(
						...[ 0, 1 ].map(
							( k ) =>
								( at[ k ] + size[ k ] / 2 + p[ k ] - view[ k ] / 2 ) / w +
								view[ k ] / 2
						)
					);
					points.push( left + x * scale, top + y * scale, -p[ 2 ] / w );
				}
			}
			return points;
		};

		return {
			name: 'hit',

			/**
			 * @param {number} x On the page, as `clientX` of an event.
			 * @param {number} y As `clientY`.
			 * @return {number | undefined} The slide that is seen there, -1
			 *                              for none; nothing when the page
			 *                              draws the slides.
			 */
			at( x, y ) {
				let found;
				let nearest = Infinity;
				slides.forEach( ( _, i ) => {
					const points = mesh( i );
					if ( ! points ) {
						return;
					}
					found ??= -1;
					const corner = ( row, column ) =>
						3 * ( row * ( GRID + 1 ) + column );
					for ( let k = 0; k < GRID * GRID * 2; k++ ) {
						const row = Math.floor( k / 2 / GRID );
						const column = ( k >> 1 ) % GRID;
						// The two halves of a square.
						const [ a, b, c ] =
							k % 2
								? [ corner( row, column + 1 ), corner( row + 1, column ), corner( row + 1, column + 1 ) ]
								: [ corner( row, column ), corner( row + 1, column ), corner( row, column + 1 ) ];
						const bx = points[ b ] - points[ a ];
						const by = points[ b + 1 ] - points[ a + 1 ];
						const cx = points[ c ] - points[ a ];
						const cy = points[ c + 1 ] - points[ a + 1 ];
						const area = bx * cy - cx * by;
						const u = ( ( x - points[ a ] ) * cy - cx * ( y - points[ a + 1 ] ) ) / area;
						const v = ( bx * ( y - points[ a + 1 ] ) - ( x - points[ a ] ) * by ) / area;
						if ( u >= 0 && v >= 0 && u + v <= 1 ) {
							const far =
								points[ a + 2 ] +
								u * ( points[ b + 2 ] - points[ a + 2 ] ) +
								v * ( points[ c + 2 ] - points[ a + 2 ] );
							// As the canvas: what is drawn later is on top
							// of what is as far.
							if ( far <= nearest + 0.001 ) {
								nearest = far;
								found = i;
							}
						}
					}
				} );
				return found;
			},

			/**
			 * @param {number} i Slide.
			 * @return {{ left: number, top: number, width: number, height: number } | null}
			 *         What is around the slide as it is drawn, on the page;
			 *         null when the canvas does not draw it.
			 */
			where( i ) {
				const points = mesh( i );
				if ( ! points ) {
					return null;
				}
				const of = ( k ) => points.filter( ( _, n ) => n % 3 === k );
				const left = Math.min( ...of( 0 ) );
				const top = Math.min( ...of( 1 ) );
				return {
					left,
					top,
					width: Math.max( ...of( 0 ) ) - left,
					height: Math.max( ...of( 1 ) ) - top,
				};
			},
		};
	};
}
