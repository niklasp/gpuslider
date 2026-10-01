/**
 * GLSL that effects share. An effect names what it needs in its `head`;
 * what several effects name is there once.
 */

/**
 * `hash( vec2 )`, `noise( vec2 )` and `fbm( vec2 )`: 0 to 1.
 *
 * The hash is one without a sine (Dave Hoskins, "Hash without Sine"): the
 * sine of a large number is another number on every graphics card, and
 * another one in WebGPU than in WebGL.
 */
export const NOISE = `
float hash( vec2 p ) {
	vec3 q = fract( vec3( p.x, p.y, p.x ) * 0.1031 );
	q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
	return fract( ( q.x + q.y ) * q.z );
}
float noise( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	return mix(
		mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ),
		mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ),
		u.y
	);
}
float fbm( vec2 p ) {
	float v = 0.0;
	float a = 0.5;
	for ( int i = 0; i < 5; i++ ) {
		v += a * noise( p );
		p *= 2.0;
		a *= 0.5;
	}
	return v;
}`;

/**
 * `aspectUv( uv )`: uv with square pixels around the centre, so circles
 * are round; x runs wider than 1 on a wide quad. `fromAspect( p )`: back.
 */
export const ASPECT = `
vec2 aspectUv( vec2 uv ) {
	return ( uv - 0.5 ) * vec2( uSize.x / uSize.y, 1.0 );
}
vec2 fromAspect( vec2 p ) {
	return p / vec2( uSize.x / uSize.y, 1.0 ) + 0.5;
}`;

/**
 * `near( uv, size )`: 1 under the pointer, nothing `size` heights of the
 * slide away from it, and nothing while the pointer is not over the slider.
 * `rawNear( uv, size )`: the same wherever the pointer is.
 */
export const NEAR = `
float rawNear( vec2 uv, float size ) {
	vec2 d = ( uv - uPointer ) * vec2( uSize.x / uSize.y, 1.0 ) / size;
	return exp( -3.0 * dot( d, d ) );
}
float near( vec2 uv, float size ) {
	return rawNear( uv, size ) * uPointerIn;
}`;

/** `toCentre()`: how far the slide is from the middle of the view, px. */
export const CENTRE = `
float toCentre() {
	return uView.x * 0.5 - uQuad.x - uQuad.z * 0.5;
}`;

/**
 * `glyph( q, c )`: 1 where a character is drawn in a cell, 0 where not,
 * at `q` in the cell, 0 to 1. Which character is by how light `c` is,
 * from none to `.`, `:`, `+`, `#` and `O`: a ramp of ASCII art, made of
 * shapes, no font.
 */
export const GLYPH = `
float glyph( vec2 q, vec3 c ) {
	float level = floor( clamp( dot( c, vec3( 0.3, 0.59, 0.11 ) ) * 1.3, 0.0, 0.999 ) * 6.0 );
	vec2 d = abs( q - 0.5 );
	float low = step( length( q - vec2( 0.5, 0.74 ) ), 0.11 );
	float high = step( length( q - vec2( 0.5, 0.3 ) ), 0.11 );
	float plus = max( step( d.x, 0.07 ) * step( d.y, 0.32 ), step( d.y, 0.07 ) * step( d.x, 0.32 ) );
	float grid = max( step( abs( d.x - 0.17 ), 0.06 ), step( abs( d.y - 0.17 ), 0.06 ) ) * step( d.x, 0.36 ) * step( d.y, 0.38 );
	float ring = max( step( abs( length( q - 0.5 ) - 0.3 ), 0.07 ), step( length( q - 0.5 ), 0.1 ) );
	float g = level < 0.5 ? 0.0 : low;
	g = level < 1.5 ? g : max( low, high );
	g = level < 2.5 ? g : plus;
	g = level < 3.5 ? g : grid;
	return level < 4.5 ? g : ring;
}`;
