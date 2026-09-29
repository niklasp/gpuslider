/**
 * The slides are seen as on a dome: what is far from its middle is
 * smaller and nearer to it.
 *
 * Moves the mesh, in the plane: nothing of it leaves the canvas.
 *
 * `centre` and `size` can be written into while the effect runs. A wall
 * of several sliders is one dome when each of them is told where the
 * middle of the wall is, and how large it is.
 *
 * @param {Object}   [options]        Options.
 * @param {number}   [options.amount] How round.
 * @param {number[]} [options.centre] The middle of the dome, px from the
 *                                    middle of the slider: along the way
 *                                    of the slides, and across.
 * @param {number[]} [options.size]   How wide the dome is, px. Without it,
 *                                    as wide as the slider.
 * @return {import('../program.js').Effect} Effect.
 */
export const dome = ( {
	amount = 0.6,
	centre = [ 0, 0 ],
	size = [ 0 ],
} = {} ) => ( {
	params: { amount, centre, size },
	vertex: `
	vec2 away = uQuad.xy + uQuad.zw * 0.5 + p.xy - uView * 0.5 - centre;
	float wide = size > 0.0 ? size : uView.x;
	float far = dot( away, away ) / ( wide * wide );
	vec2 to = p.xy - away * ( 1.0 - 1.0 / ( 1.0 + amount * far ) );
	return vec3( to, p.z );`,
	place( p, { view, quad } ) {
		// Numbers, or what the page writes into.
		const of = ( value, k = 0 ) => ( value.map ? value[ k ] : value );
		const wide = of( size ) > 0 ? of( size ) : view[ 0 ];
		const away = [ 0, 1 ].map(
			( k ) =>
				quad[ k ] +
				quad[ k + 2 ] / 2 +
				p[ k ] -
				view[ k ] / 2 -
				of( centre, k )
		);
		const far = ( away[ 0 ] ** 2 + away[ 1 ] ** 2 ) / wide ** 2;
		const by = 1 - 1 / ( 1 + of( amount ) * far );
		p[ 0 ] -= away[ 0 ] * by;
		p[ 1 ] -= away[ 1 ] * by;
	},
} );
