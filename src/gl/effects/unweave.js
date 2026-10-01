// Where on the screen a slide comes apart: by the point of the view, not
// by the slide, so that only what is near an end of the view frays.
const AT_EDGE = `
float side_() {
	return sign( uQuad.x + uQuad.z * 0.5 - uView.x * 0.5 );
}
float fray_( float x, float start ) {
	return smoothstep( start, 1.0, ( x / uView.x * 2.0 - 1.0 ) * side_() );
}
float grow_( float amount, float start ) {
	return amount * fray_( uQuad.x + uQuad.z * ( 0.5 + 0.5 * side_() ), start );
}
float along_( vec2 uv, float amount, float start ) {
	float g = grow_( amount, start );
	return uv.x * ( 1.0 + g ) - step( side_(), -0.5 ) * g;
}
float thread_( float y, float threads ) {
	return fract( sin( floor( y * threads ) * 12.9898 ) * 43758.5453 );
}
`;

/**
 * The slides come apart into threads near the two ends of the view, as off
 * a loom: where a slide leaves the screen or comes in, each row of it runs
 * on past the image for a length of its own. Away from the ends nothing
 * happens.
 *
 * Moves the mesh.
 *
 * @param {Object}            [options]         Options.
 * @param {number | number[]} [options.amount]  How far the threads reach
 *                                              at the end of the view, in
 *                                              widths of the slide.
 * @param {number | number[]} [options.threads] Rows of threads in the
 *                                              height of a slide.
 * @param {number | number[]} [options.start]   Where it begins, from the
 *                                              middle of the view (0) to
 *                                              its end (1).
 * @param {number | number[]} [options.gap]     Room between the threads,
 *                                              0 to 1.
 * @param {number | number[]} [options.split]   How far the colours of a
 *                                              thread come apart.
 * @return {import('../program.js').Effect} Effect.
 */
export const unweave = ( {
	amount = 0.8,
	threads = 70,
	start = 0.55,
	gap = 0.5,
	split = 0,
} = {} ) => ( {
	head: AT_EDGE,
	params: { amount, threads, start, gap, split },
	vertex: `
	float g = grow_( amount, start );
	return vec3( p.x * ( 1.0 + g ) + side_() * g * uQuad.z * 0.5, p.y, p.z );`,
	uv: `
	float u = along_( uv, amount, start );
	float k = fray_( uQuad.x + u * uQuad.z, start );
	// Pulled out along its thread, the more the nearer the end.
	return vec2( u - side_() * k * k * amount * 0.5 * thread_( uv.y, threads ), uv.y );`,
	color: `
	float g = grow_( amount, start );
	float u = along_( uv, amount, start );
	float k = fray_( uQuad.x + u * uQuad.z, start );
	float e = split * k * 0.02;
	color = vec4( media( uv + vec2( e, 0.0 ) ).r, color.g, media( uv - vec2( e, 0.0 ) ).b, color.a );
	// Past the image every thread ends at a length of its own.
	float past = side_() > 0.0 ? u - 1.0 : -u;
	float end = g * ( 0.3 + 0.7 * thread_( uv.y, threads * 1.7 ) );
	float room = gap * k * smoothstep( 0.3, 0.9, abs( fract( uv.y * threads ) - 0.5 ) * 2.0 );
	return color * ( 1.0 - smoothstep( end - 0.15 * g, end, past ) ) * ( 1.0 - room );`,
} );
