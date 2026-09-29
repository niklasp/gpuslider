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
