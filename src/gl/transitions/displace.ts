import { NOISE, ASPECT } from '../glsl.js';

/**
 * A cloudy displacement map pushes both images apart in two
 * directions while they crossfade.
 */
export const displace = () => ( {
	head: [ NOISE, ASPECT ],
	transition: `
vec4 transition( vec2 uv ) {
	vec2 p = aspectUv( uv ) * 2.5;
	vec2 d = vec2( fbm( p ), fbm( p + vec2( 3.1, 7.4 ) ) ) - 0.5;
	vec4 from = getFromColor( uv + d * 0.5 * progress );
	vec4 to = getToColor( uv - d * 0.5 * ( 1.0 - progress ) );
	return mix( from, to, progress );
}`,
} );
