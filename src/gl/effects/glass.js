import { NEAR } from '../glsl.js';

/**
 * Fluted glass around the pointer.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.size]   How far around the pointer, in heights of
 *                                  the slide.
 * @param {number} [options.lines]  Flutes per width of the slide.
 * @param {number} [options.amount] How much they bend.
 * @return {import('../program.js').Effect} Effect.
 */
export const glass = ( { size = 0.6, lines = 30, amount = 1 } = {} ) => ( {
	head: NEAR,
	params: { size, lines, amount },
	uv: `
	float flute = fract( uv.x * lines ) - 0.5;
	uv.x += flute * amount * 0.06 * near( uv, size );
	return uv;`,
} );
