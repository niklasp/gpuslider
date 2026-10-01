import type { Effect } from './program.js';

/**
 * Several transitions in one shader, of which one is drawn: the one that
 * is picked, and another can be picked while the slider runs, without a
 * shader or a slider made again. A page that has one transition names
 * that one and has only that in its bundle; one that offers a choice
 * names all it offers.
 *
 *     const turn = choose( [ liquid(), burn(), push() ] );
 *     createSlider( element, { plugins: [ stack(), canvas( { effects: [ turn ] } ) ] } );
 *     turn.pick( 1 ); // burn, from the next move on
 *
 * @param transitions Transitions.
 * @param start The one picked first.
 * @return An effect with the transitions, and `pick( i )`.
 */
export const choose = ( transitions: Effect[], start = 0 ): Effect & { pick: ( i: number ) => void } => {
	// Written into, and told to the shader on every frame.
	const which = [ start ];
	const last = transitions.length - 1;
	return {
		head: transitions.flatMap( ( { head } ) => [ head ].flat() ).filter( Boolean ) as string[],
		params: { which },
		// Each is `transition( uv )`: here each has a number of its own.
		transition:
			transitions
				.map( ( one, i ) =>
					one.transition!.replace( /\bvec4\s+transition(?=\s*\()/, `vec4 transition${ i }` )
				)
				.join( '\n' ) +
			'\nvec4 transition( vec2 uv ) {\n' +
			transitions
				.slice( 0, last )
				.map( ( _, i ) => `if ( which < ${ i }.5 ) { return transition${ i }( uv ); }\n` )
				.join( '' ) +
			`return transition${ last }( uv );\n}`,
		pick: ( i ) => {
			which[ 0 ] = i;
		},
	};
};
