import { ASPECT } from '../glsl.js';

/**
 * The image bulges through a lens with rainbow fringes, then settles
 * into the next one.
 */
export const lens = () => ( {
	head: [ ASPECT ],
	transition: `
vec2 bulge( vec2 p, float k ) {
	return p * ( 1.0 - k * dot( p, p ) );
}
vec4 lensColor( vec2 p, float k, float m ) {
	vec2 u = fromAspect( bulge( p, k ) );
	return mix( getFromColor( u ), getToColor( u ), m );
}
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float m = smoothstep( 0.35, 0.65, progress );
	vec2 p = aspectUv( uv );
	float k = 0.55 * s;
	float spread = 0.09 * s;
	vec4 r = lensColor( p, k + spread, m );
	vec4 g = lensColor( p, k, m );
	vec4 b = lensColor( p, k - spread, m );
	return vec4( r.r, g.g, b.b, g.a );
}`,
} );
