import { NOISE, ASPECT } from '../glsl.js';

/**
 * Both images are pushed sideways by a noise field while the next one
 * flows in along the noise.
 */
export const liquid = () => ( {
	head: [ NOISE, ASPECT ],
	transition: `
vec4 transition( vec2 uv ) {
	float d = fbm( aspectUv( uv ) * 3.0 );
	vec2 shift = vec2( 0.28 * d, 0.0 );
	vec4 from = getFromColor( uv + shift * progress );
	vec4 to = getToColor( uv - shift * ( 1.0 - progress ) );
	return mix( from, to, smoothstep( 0.0, 1.0, progress * 1.6 - d * 0.6 ) );
}`,
} );
