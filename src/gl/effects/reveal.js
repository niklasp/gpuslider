import { NEAR } from '../glsl.js';

/**
 * While the pointer is over the slider the images lose their colours,
 * except around the pointer.
 *
 * @param {Object} [options]      Options.
 * @param {number} [options.size] How far around the pointer, in heights of
 *                                the slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const reveal = ( { size = 0.6 } = {} ) => ( {
	head: NEAR,
	params: { size },
	color: `
	vec3 gray = vec3( dot( color.rgb, vec3( 0.299, 0.587, 0.114 ) ) );
	float without = uPointerIn * ( 1.0 - rawNear( uv, size ) );
	return vec4( mix( color.rgb, gray, without ), color.a );`,
} );
