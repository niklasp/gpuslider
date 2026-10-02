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
	// `$T` turns between the page's way and the effects' (see `compose()`):
	// a slider that goes down has its place and view turned by a quarter.
	transition:
		// Where a point of the view is in the place: the two pictures there.
		'vec2 sweepPlace( vec2 p ) { return ( ( p$T * uView - uQuad.xy ) / uQuad.zw )$T; }\n' +
		'vec4 sweepFrom( vec2 p ) { return getFromColor( sweepPlace( p ) ); }\n' +
		'vec4 sweepTo( vec2 p ) { return getToColor( sweepPlace( p ) ); }\n' +
		// The shape of the view, not of the place.
		'vec2 sweepAspect( vec2 p ) { return ( p - 0.5 ) * vec2( uView$T.x / uView$T.y, 1.0 ); }\n' +
		'vec2 sweepUnaspect( vec2 p ) { return p / vec2( uView$T.x / uView$T.y, 1.0 ) + 0.5; }\n' +
		transition.transition!
			.replace( /\bgetFromColor\b/g, 'sweepFrom' )
			.replace( /\bgetToColor\b/g, 'sweepTo' )
			.replace( /\baspectUv\b/g, 'sweepAspect' )
			.replace( /\bfromAspect\b/g, 'sweepUnaspect' )
			.replace( /\bresolution\b/g, 'uView$T' )
			.replace( /\bvec4\s+transition(?=\s*\()/, 'vec4 sweepAll' ) +
		'\nvec4 transition( vec2 uv ) { return sweepAll( ( ( uQuad.xy + uv$T * uQuad.zw ) / uView )$T ); }',
} );
