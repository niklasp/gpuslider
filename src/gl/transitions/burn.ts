import { NOISE, ASPECT } from '../glsl.js';

/**
 * The image burns away along a noise front with a glowing edge.
 */
export const burn = () => ( {
	head: [ NOISE, ASPECT ],
	transition: `
vec4 transition( vec2 uv ) {
	float n = fbm( aspectUv( uv ) * 5.0 );
	float t = mix( -0.1, 1.1, progress );
	float m = smoothstep( n - 0.03, n + 0.03, t );
	float glow = ( 1.0 - smoothstep( 0.0, 0.12, abs( t - n ) ) ) * sin( progress * PI );
	vec4 c = mix( getFromColor( uv ), getToColor( uv ), m );
	vec3 fire = mix( vec3( 1.0, 0.25, 0.0 ), vec3( 1.0, 0.85, 0.3 ), glow );
	return vec4( c.rgb + fire * glow * glow, max( c.a, glow ) );
}`,
} );
