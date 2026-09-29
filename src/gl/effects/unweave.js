// Where a slide is in the view, and how far it has come apart.
const AT_EDGE = `
float edge_() {
	return ( uQuad.x + uQuad.z * 0.5 ) / uView.x * 2.0 - 1.0;
}
float reach_( float amount ) {
	return amount * smoothstep( 0.2, 1.0, abs( edge_() ) );
}
float past_( vec2 uv, float amount ) {
	float g = reach_( amount );
	return ( edge_() > 0.0 ? uv.x : 1.0 - uv.x ) * ( 1.0 + g );
}
float thread_( vec2 uv, float threads ) {
	return fract( sin( floor( uv.y * threads ) * 12.9898 ) * 43758.5453 );
}
`;

/**
 * The slides come apart into threads near the edges of the view, as off a
 * loom: the slide reaches out, and each of its rows runs on from the edge
 * of the image for a length of its own. In the middle nothing happens.
 *
 * Moves the mesh.
 *
 * @param {Object} [options]         Options.
 * @param {number} [options.amount]  How far the threads reach at the edge
 *                                   of the view, in widths of the slide.
 * @param {number} [options.threads] Rows of threads in the height of a
 *                                   slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const unweave = ( { amount = 0.8, threads = 70 } = {} ) => ( {
	head: AT_EDGE,
	params: { amount, threads },
	vertex: `
	float g = reach_( amount );
	return vec3( p.x * ( 1.0 + g ) + sign( edge_() ) * g * uQuad.z * 0.5, p.y, p.z );`,
	uv: `
	float g = reach_( amount );
	float past = past_( uv, amount );
	// Pulled out along the thread, the more the further out.
	past -= thread_( uv, threads ) * g * 0.5 * smoothstep( 0.4, 1.0, past );
	return vec2( edge_() > 0.0 ? past : 1.0 - past, uv.y );`,
	color: `
	float g = reach_( amount );
	float past = past_( uv, amount );
	float end = 1.0 + g * ( 0.25 + 0.75 * thread_( uv, threads ) );
	// Beyond the image, a little room between the threads.
	float gap = step( 1.0, past ) * smoothstep( 0.4, 0.9, abs( fract( uv.y * threads ) - 0.5 ) * 2.0 );
	return color * ( 1.0 - smoothstep( end - 0.2 * g, end, past ) ) * ( 1.0 - gap );`,
} );
