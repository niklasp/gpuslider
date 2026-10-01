/**
 * The slides are slabs of thick glass, as a lens is: the flat of it
 * magnifies a little, and its edge is a bevel, round as a pebble's, through
 * which the image is refracted as by glass (Snell's law, each colour a
 * little otherwise, most at the rim). It is lit by a light at the top left:
 * a bright line where the rim faces it, a fainter one where the light
 * leaves on the other side, a broad gleam on the bevel, the sheen of what
 * glass reflects at a slant (Fresnel), and a gloss over the flat with a
 * streak in it that moves when the glass does. The steep of the bevel is
 * darker, as thick glass is, most on the side away from the light.
 *
 * Glass after glass-effect-webgpu by jeantimex: its look, not its code.
 *
 * In the shader: `inside` is how far inside the outline of the slide a
 * point is, px, as the page cuts it (radius and corner shape), `n` which
 * way is out; `t` goes across the bevel from its flat to its rim, 0 to 1,
 * and `N` is the normal of a quarter of a circle there.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.edge]   How wide the bevel of the glass is, px.
 * @param {number} [options.bend]   How much it bends the image.
 * @param {number} [options.spread] How far the colours come apart.
 * @param {number} [options.shine]  How bright the light on it is.
 * @param {number} [options.zoom]   How much the flat magnifies.
 * @return {import('../program.js').Effect} Effect.
 */
export const slab = ( {
	edge = 28,
	bend = 1,
	spread = 0.4,
	shine = 0.5,
	zoom = 0.04,
} = {} ) => ( {
	params: { edge, bend, spread, shine, zoom },
	color: `
vec2 at = ( uv - 0.5 ) * uSize;
float r = max( uRadius, edge );
vec2 d = abs( at ) - uSize * 0.5 + r;
vec2 q = max( d, vec2( 0.0 ) ) / r;
float inside = pow( pow( q.x, uShape ) + pow( q.y, uShape ), 1.0 / uShape ) * r + min( max( d.x, d.y ), 0.0 ) - r;
vec2 n = sign( at ) * normalize( mix( step( d.yx, d.xy ), pow( q, vec2( uShape - 1.0 ) ) + 1e-4, step( 0.0, min( d.x, d.y ) ) ) );
float t = clamp( 1.0 + inside / edge, 0.0, 0.995 );
vec3 N = normalize( vec3( n * t / sqrt( 1.0 - t * t ), 1.0 ) );
vec3 V = vec3( 0.0, 0.0, 1.0 );
vec2 pull = refract( -V, N, 0.667 ).xy * edge * bend * 1.6 / uSize;
vec2 lens = 0.5 + ( uv - 0.5 ) / ( 1.0 + zoom );
vec4 seen = media( lens + pull );
float k = spread * ( 0.15 + 0.6 * t );
float red = media( lens + pull * ( 1.0 - k ) ).r;
float blue = media( lens + pull * ( 1.0 + k ) ).b;
vec3 L = normalize( vec3( -0.55, -0.8, 0.6 ) );
float facing = dot( n, normalize( L.xy ) );
float rim = smoothstep( -3.5, -1.2, inside ) * ( 1.0 - smoothstep( -0.6, 0.0, inside ) );
float lit = pow( max( dot( reflect( -L, N ), V ), 0.0 ), 10.0 ) * t * 1.4
	+ rim * ( 0.6 + 1.2 * max( facing, 0.0 ) + 0.8 * max( -facing, 0.0 ) )
	+ 0.5 * pow( 1.0 - N.z, 2.5 ) * ( 0.6 + 0.4 * facing );
float along = uv.x + uv.y * 0.35 - 0.3 + uVelocity * 0.12;
lit += 0.12 * smoothstep( 0.0, 0.02, along ) * ( 1.0 - smoothstep( 0.02, 0.14, along ) ) + 0.07 * ( 1.0 - uv.x * 0.6 - uv.y * 0.8 );
float shade = 1.0 - t * t * ( 0.2 + 0.35 * max( -facing, 0.0 ) );
return vec4( vec3( red, seen.g, blue ) * shade + max( lit, 0.0 ) * shine * 1.6 * seen.a, seen.a );`,
} );
