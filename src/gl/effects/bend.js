/**
 * The row of slides is an arc: towards the sides of the view the slides
 * go back. The faster the slider, the deeper the arc.
 *
 * Moves the mesh, which a flat slider cannot do.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.amount] Depth of the arc at rest.
 * @param {number} [options.speed]  Depth that the speed adds.
 * @return {Object} Effect.
 */
export const bend = ( { amount = 0.5, speed = 0.25 } = {} ) => ( {
	params: { amount, speed },
	vertex: `
	// Where the point is in the view, -1 to 1.
	float x = ( uQuad.x + uQuad.z * 0.5 + p.x ) / uView.x * 2.0 - 1.0;
	float depth = amount + speed * min( abs( uVelocity ), 6.0 );
	p.z -= depth * x * x * uView.x * 0.3;
	return p;`,
} );
