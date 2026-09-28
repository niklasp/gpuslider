import { NOISE } from '../glsl.js';

/**
 * Square blocks switch to the next image in random order.
 */
export const blocks = () => ( {
	head: [ NOISE ],
	transition: `
vec4 transition( vec2 uv ) {
	vec2 grid = vec2( floor( 16.0 * resolution.x / resolution.y + 0.5 ), 16.0 );
	float order = hash( floor( uv * grid ) );
	float m = step( order, progress * 1.02 - 0.01 );
	return mix( getFromColor( uv ), getToColor( uv ), m );
}`,
} );
