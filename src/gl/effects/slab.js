/**
 * The slides are slabs of thick glass. Their edge is a bevel, round as a
 * pebble's: through it the image is refracted as by glass (Snell's law,
 * each colour a little otherwise), and it is lit by a light at the top
 * left: a thin line where the rim faces it, a fainter one where the light
 * leaves on the other side, and the sheen of what glass reflects at a
 * slant (Fresnel). The flat of it has a streak of reflection that moves
 * when the glass does.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.edge]   How wide the bevel of the glass is, px.
 * @param {number} [options.bend]   How much it bends the image.
 * @param {number} [options.spread] How far the colours come apart.
 * @param {number} [options.shine]  How bright the light on it is.
 * @return {import('../program.js').Effect} Effect.
 */
export const slab = ( {
	edge = 28,
	bend = 1,
	spread = 0.4,
	shine = 0.5,
} = {} ) => ( {
	params: { edge, bend, spread, shine },
	color: `
	vec2 at = ( uv - 0.5 ) * uSize;
	// The outline of the slide, as the page cuts it: how far inside, and
	// which way is out.
	float r = max( uRadius, edge );
	vec2 d = abs( at ) - uSize * 0.5 + r;
	vec2 q = max( d, vec2( 0.0 ) ) / r;
	float inside = pow( pow( q.x, uShape ) + pow( q.y, uShape ), 1.0 / uShape ) * r
		+ min( max( d.x, d.y ), 0.0 ) - r;
	vec2 n = sign( at ) * normalize( mix(
		step( d.yx, d.xy ),
		pow( q, vec2( uShape - 1.0 ) ) + 1e-4,
		step( 0.0, min( d.x, d.y ) )
	) );
	// Across the bevel from its flat to its rim, 0 to 1, and how steep it
	// is there: a quarter of a circle.
	float t = clamp( 1.0 + inside / edge, 0.0, 0.995 );
	vec3 N = normalize( vec3( n * t / sqrt( 1.0 - t * t ), 1.0 ) );
	vec3 V = vec3( 0.0, 0.0, 1.0 );
	vec2 pull = refract( -V, N, 0.667 ).xy * edge * bend / uSize;
	vec4 seen = media( uv + pull );
	float red = media( uv + pull * ( 1.0 - 0.3 * spread ) ).r;
	float blue = media( uv + pull * ( 1.0 + 0.3 * spread ) ).b;

	vec3 L = normalize( vec3( -0.55, -0.8, 0.6 ) );
	float facing = dot( n, normalize( L.xy ) );
	// The light on the bevel, and a line of it along the rim, 2 px.
	float spec = pow( max( dot( reflect( -L, N ), V ), 0.0 ), 48.0 );
	float line = smoothstep( -3.0, -1.0, inside ) * ( 1.0 - smoothstep( -1.0, 0.0, inside ) );
	float light = spec
		+ line * ( 0.25 + 0.75 * max( facing, 0.0 ) + 0.4 * max( -facing, 0.0 ) )
		+ 0.35 * pow( 1.0 - N.z, 3.0 );
	// A streak of reflection on the flat of it.
	float along = uv.x + uv.y * 0.35 - 0.3 + uVelocity * 0.12;
	light += 0.1 * smoothstep( 0.0, 0.02, along ) * ( 1.0 - smoothstep( 0.02, 0.12, along ) );
	// The bevel is darker where it is steep, as thick glass is, and most
	// on the side away from the light.
	float shade = 1.0 - t * t * t * ( 0.25 + 0.3 * max( -facing, 0.0 ) );
	return vec4( vec3( red, seen.g, blue ) * shade + light * shine * 1.6 * seen.a, seen.a );`,
} );
