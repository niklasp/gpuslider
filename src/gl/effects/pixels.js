import { NEAR } from '../glsl.js';

/**
 * Coarse pixels around the pointer.
 *
 * @param {Object} [options]       Options.
 * @param {number} [options.size]  How far around the pointer, in heights of
 *                                 the slide.
 * @param {number} [options.cells] Pixels per height of the slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const pixels = ( { size = 0.5, cells = 36 } = {} ) => ( {
	head: NEAR,
	params: { size, cells },
	uv: `
	vec2 grid = vec2( cells * uSize.x / uSize.y, cells );
	vec2 coarse = ( floor( uv * grid ) + 0.5 ) / grid;
	return mix( uv, coarse, step( 0.35, near( coarse, size ) ) );`,
} );
