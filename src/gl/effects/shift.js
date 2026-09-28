import { NEAR } from '../glsl.js';

/**
 * The colours come apart around the pointer, along its way: the faster it
 * moves, the further.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.size]   How far around the pointer, in heights of
 *                                  the slide.
 * @param {number} [options.amount] How much.
 * @return {import('../program.js').Effect} Effect.
 */
export const shift = ( { size = 0.7, amount = 1 } = {} ) => ( {
	head: NEAR,
	params: { size, amount },
	color: `
	vec2 d = clamp( uPointerSpeed, -4.0, 4.0 ) * near( uv, size ) * amount * 0.03;
	return vec4( media( uv + d ).r, color.g, media( uv - d ).b, color.a );`,
} );
