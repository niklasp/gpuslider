import { ASPECT } from '../glsl.js';

/**
 * A vortex twists the image away and the next one twists in, turning
 * the same way throughout (it doesn't wind back).
 */
export const swirl = () => ( {
	head: [ ASPECT ],
	transition: `
vec2 twist( vec2 p, float angle ) {
	float c = cos( angle );
	float sn = sin( angle );
	return mat2( c, -sn, sn, c ) * p;
}
vec4 transition( vec2 uv ) {
	vec2 p = aspectUv( uv );
	float s = sin( progress * PI );
	float falloff = 1.0 - smoothstep( 0.0, 0.9, length( p ) );
	p *= 1.0 - 0.25 * s;
	vec2 qf = fromAspect( twist( p, 5.0 * progress * falloff ) );
	vec2 qt = fromAspect( twist( p, -5.0 * ( 1.0 - progress ) * falloff ) );
	return mix( getFromColor( qf ), getToColor( qt ), smoothstep( 0.35, 0.65, progress ) );
}`,
} );
