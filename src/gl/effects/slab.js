/**
 * The slides are slabs of thick glass: at their edge the image is bent
 * and its colours come apart, one side has the light on it and the other
 * its shade.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.edge]   How wide the edge of the glass is, px.
 * @param {number} [options.bend]   How much it bends the image, in widths
 *                                  of the edge.
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
	float corner = max( uRadius, edge );
	vec2 d = abs( at ) - uSize * 0.5 + corner;
	vec2 outer = max( d, vec2( 0.0 ) );
	float inside = length( outer ) + min( max( d.x, d.y ), 0.0 ) - corner;
	// 0 where the glass is flat, 1 where it ends.
	float rim = smoothstep( -edge, 0.0, inside );
	// Where the edge looks.
	vec2 straight = step( d.yx, d.xy );
	float both = step( 0.0, min( d.x, d.y ) );
	vec2 n = mix( straight, normalize( outer + 0.0001 ), both ) * sign( at );

	vec2 pull = n * rim * rim * bend * edge / uSize;
	vec4 seen = media( uv - pull );
	float red = media( uv - pull * ( 1.0 + spread ) ).r;
	float blue = media( uv - pull * ( 1.0 - spread ) ).b;

	float lit = dot( n, normalize( vec2( -0.5, -0.8 ) ) );
	float light = rim * max( lit, 0.0 ) + 0.3 * rim * rim * max( -lit, 0.0 );
	// Where the flat of the glass ends there is a line of light.
	float line = smoothstep( 0.0, 0.4, rim ) * ( 1.0 - smoothstep( 0.4, 0.9, rim ) );
	// And a band of it lies on the glass, which moves when the glass does.
	float along = uv.x + uv.y * 0.35 - 0.25 + uVelocity * 0.12;
	float band = smoothstep( 0.0, 0.06, along ) * ( 1.0 - smoothstep( 0.06, 0.32, along ) );
	float shade = 1.0 - 0.4 * rim * max( -lit, 0.0 );
	vec3 glass = vec3( red, seen.g, blue ) * shade
		+ ( light + line * 0.4 + band * 0.18 ) * shine * seen.a;
	return vec4( glass, seen.a );`,
} );
