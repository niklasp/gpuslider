import { ASPECT } from '../glsl.js';

/**
 * A ring grows from the centre; the water behind it ripples.
 */
export const ripple = () => ( {
	head: [ ASPECT ],
	transition: `
vec4 transition( vec2 uv ) {
	vec2 p = aspectUv( uv );
	float dist = length( p );
	float reach = length( vec2( resolution.x / resolution.y, 1.0 ) ) * 0.5 + 0.25;
	float front = progress * reach;
	float behind = 1.0 - smoothstep( front - 0.05, front + 0.25, dist );
	float wave = sin( dist * 45.0 - progress * 30.0 ) * 0.02 * sin( progress * PI ) * behind;
	vec2 dir = dist > 0.0 ? p / dist : vec2( 0.0 );
	vec2 q = fromAspect( p + dir * wave );
	return mix( getToColor( q ), getFromColor( q ), smoothstep( front - 0.2, front, dist ) );
}`,
} );
