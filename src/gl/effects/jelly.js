/**
 * The slides are soft: what moves them pulls them out of shape. Their
 * middle hangs back, they get longer along the way and thinner across, and
 * no two of them lean the same.
 *
 * Moves the mesh. Give the slider padding for what leaves its place.
 *
 * `across` can be written into while the effect runs: the speed of what
 * moves the slider the other way, a page that is scrolled for one.
 *
 * @param {Object}   [options]        Options.
 * @param {number}   [options.amount] How soft.
 * @param {number[]} [options.across] Speed across the way of the slides,
 *                                    in views per second.
 * @return {import('../program.js').Effect} Effect.
 */
export const jelly = ( { amount = 1, across = [ 0 ] } = {} ) => ( {
	params: { amount, across },
	vertex: `
	vec2 speed = clamp( vec2( uVelocity, across ) * amount, vec2( -2.5 ), vec2( 2.5 ) );
	vec2 q = p.xy / uSize;
	vec2 middle = 1.0 - 4.0 * q.yx * q.yx;
	// Each slide its own way.
	float lean = sin( uProgress * 2.4 + 1.0 );
	vec2 give = speed * 0.1 * ( middle + lean * q.yx ) + speed.yx * 0.08 * lean * q.yx;
	vec2 longer = 1.0 + ( abs( speed ) - abs( speed.yx ) * 0.6 ) * 0.05;
	return vec3( ( q * longer - give ) * uSize, p.z );`,
} );
