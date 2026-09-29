/**
 * The image in squares around the pointer, each of them showing its own
 * part closer: a grid of small lenses in the wake of the pointer. The
 * faster the pointer, the further they reach; where it rests, they are
 * gone.
 *
 * @param {Object} [options]       Options.
 * @param {number} [options.size]  Side of a square, px.
 * @param {number} [options.zoom]  How much closer in the middle: 1 is twice.
 * @param {number} [options.reach] How far around the pointer at a speed of
 *                                 one slide per second, in heights of the
 *                                 slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const cells = ( { size = 36, zoom = 0.8, reach = 0.25 } = {} ) => ( {
	params: { size, zoom, reach },
	uv: `
	vec2 px = uv * uSize;
	vec2 middle = ( floor( px / size ) + 0.5 ) * size;
	vec2 d = ( middle / uSize - uPointer ) * vec2( uSize.x / uSize.y, 1.0 );
	float far = length( d ) / ( reach * min( length( uPointerSpeed * uSize ) / uSize.y, 4.0 ) + 1e-4 );
	float near = ( 1.0 - smoothstep( 0.0, 1.0, far ) ) * uPointerIn;
	return ( middle + ( px - middle ) / ( 1.0 + zoom * near ) ) / uSize;`,
} );
