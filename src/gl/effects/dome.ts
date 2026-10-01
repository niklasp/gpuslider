import type { Effect } from '../program.js';

/**
 * The slides are seen as on a dome: what is far from its middle is
 * smaller and nearer to it, and what is beyond its edge is not seen.
 *
 * Moves the mesh, in the plane: nothing of it leaves the canvas.
 *
 * `centre` and `size` can be written into while the effect runs. A wall
 * of several sliders is one dome when each of them is told where the
 * middle of the wall is, and how large it is.
 *
 * @param options Options.
 * @param options.amount How round.
 * @param options.centre The middle of the dome, px from the
 *                       middle of the slider: along the way
 *                       of the slides, and across.
 * @param options.size How wide the dome is, px. Without it,
 *                     as wide as the slider.
 * @return Effect.
 */
export const dome = ( {
	amount = 0.6,
	centre = [ 0, 0 ],
	size = [ 0 ],
}: { amount?: number; centre?: number[]; size?: number[] } = {} ): Effect => ( {
	params: { amount, centre, size },
	// A point is drawn at away / ( 1 + k ) from the middle. That is
	// furthest where k is 1, and nearer again beyond: there it would come
	// back over the slides before it. So it stays at that edge, where
	// what is further on is gone, as behind a horizon.
	vertex: `
	vec2 away = uQuad.xy + uQuad.zw * 0.5 + p.xy - uView * 0.5 - centre;
	float wide = size > 0.0 ? size : uView.x;
	float k = amount * dot( away, away ) / ( wide * wide );
	vec2 held = away / sqrt( max( k, 1.0 ) );
	return vec3( p.xy - away + held / ( 1.0 + min( k, 1.0 ) ), p.z );`,
	place( p, { view, quad } ) {
		// Numbers, or what the page writes into.
		const of = ( value: number | number[], k = 0 ) => ( ( value as number[] ).map ? ( value as number[] )[ k ] : ( value as number ) );
		const wide = of( size ) > 0 ? of( size ) : view[ 0 ];
		const away = [ 0, 1 ].map(
			( k ) =>
				quad[ k ] +
				quad[ k + 2 ] / 2 +
				p[ k ] -
				view[ k ] / 2 -
				of( centre, k )
		);
		const k = ( of( amount ) * ( away[ 0 ] ** 2 + away[ 1 ] ** 2 ) ) / wide ** 2;
		const held = 1 / Math.sqrt( Math.max( k, 1 ) ) / ( 1 + Math.min( k, 1 ) );
		p[ 0 ] += away[ 0 ] * ( held - 1 );
		p[ 1 ] += away[ 1 ] * ( held - 1 );
	},
} );
