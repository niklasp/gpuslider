/**
 * The slide under the pointer leans to it, like a card that is pressed
 * where the finger is.
 *
 * Moves the mesh.
 *
 * @param {Object} [options]       Options.
 * @param {number} [options.angle] How far it leans when the pointer is at
 *                                 its edge, in degrees.
 * @return {import('../program.js').Effect} Effect.
 */
export const tilt = ( { angle = 8 } = {} ) => ( {
	params: { angle },
	vertex: `
	vec2 at = uPointer - 0.5;
	// This slide only, and softly where the pointer leaves it.
	vec2 over = 1.0 - smoothstep( 0.45, 0.6, abs( at ) );
	vec2 turn = radians( angle ) * 2.0 * at * over.x * over.y * uPointerIn;
	p.z -= p.x * sin( turn.x ) + p.y * sin( turn.y );
	p.xy *= cos( turn );
	return p;`,
} );
