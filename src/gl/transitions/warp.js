import { NOISE, ASPECT } from '../glsl.js';

/**
 * Both images are marbled by swirled, warped noise and flow one way along
 * it: the one that goes is carried off, the next comes in behind it. The
 * switch follows the marble.
 */
export const warp = () => ( {
	head: [ NOISE, ASPECT ],
	transition: `
vec4 transition( vec2 uv ) {
	vec2 p = aspectUv( uv ) * 2.0;
	vec2 q = vec2( fbm( p ), fbm( p + vec2( 5.2, 1.3 ) ) );
	vec2 r = vec2( fbm( p + 4.0 * q + vec2( 1.7, 9.2 ) ), fbm( p + 4.0 * q + vec2( 8.3, 2.8 ) ) );
	float w = fbm( p + 4.0 * r );
	float angle = 2.5 * ( w - 0.5 );
	float c = cos( angle );
	float sn = sin( angle );
	vec2 d = mat2( c, -sn, sn, c ) * ( r - 0.5 );
	float m = smoothstep( w - 0.06, w + 0.06, progress * 1.3 - 0.15 );
	return mix(
		getFromColor( uv + d * 0.4 * progress ),
		getToColor( uv - d * 0.4 * ( 1.0 - progress ) ),
		m
	);
}`,
} );
