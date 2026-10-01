import type { Effect } from './program.js';

/**
 * A transition laid over the whole view instead of over each slide: for
 * `panes()`, whose places then turn as one picture of all of them, in one
 * sweep. Each place draws the part of the view it has, with the pictures
 * of its slides; so a burn, a front of lightning or the cells of glyphs go
 * across the gaps from one place into the next. Any transition, or several
 * in `choose()`.
 *
 *     createSlider( element, {
 *         perView: 4,
 *         plugins: [ panes( { stagger: 0 } ), canvas( { effects: [ sweep( burn() ) ] } ) ],
 *     } );
 *
 * What a transition takes from elsewhere in the picture, a push or a warp,
 * it takes from the edge of the place: the places are not one picture.
 *
 * @param transition The transition.
 * @return The same, over the view.
 */
export const sweep = ( transition: Effect ): Effect => ( {
	...transition,
	transition:
		// Where a point of the view is in the place: the two pictures there.
		'vec2 sweepPlace( vec2 p ) { return ( p * uView - uQuad.xy ) / uQuad.zw; }\n' +
		'vec4 sweepFrom( vec2 p ) { return getFromColor( sweepPlace( p ) ); }\n' +
		'vec4 sweepTo( vec2 p ) { return getToColor( sweepPlace( p ) ); }\n' +
		transition.transition!
			.replace( /\bgetFromColor\b/g, 'sweepFrom' )
			.replace( /\bgetToColor\b/g, 'sweepTo' )
			.replace( /\bresolution\b/g, 'uView' )
			.replace( /\bvec4\s+transition(?=\s*\()/, 'vec4 sweepAll' ) +
		'\nvec4 transition( vec2 uv ) { return sweepAll( ( uQuad.xy + uv * uQuad.zw ) / uView ); }',
} );
