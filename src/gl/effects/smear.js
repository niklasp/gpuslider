import { NEAR } from '../glsl.js';

/**
 * The pointer drags the image along, like a finger in wet paint: the
 * faster, the further.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.size]   How far around the pointer, in heights of
 *                                  the slide.
 * @param {number} [options.amount] How much.
 * @return {import('../program.js').Effect} Effect.
 */
export const smear = ( { size = 0.5, amount = 1 } = {} ) => ( {
	head: NEAR,
	params: { size, amount },
	uv: `
	vec2 speed = clamp( uPointerSpeed, -4.0, 4.0 );
	return uv - speed * near( uv, size ) * amount * 0.08;`,
} );
