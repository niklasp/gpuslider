import { NEAR } from '../glsl.js';
import type { Effect } from '../program.js';

/**
 * Coarse pixels around the pointer.
 *
 * @param options Options.
 * @param options.size How far around the pointer, in heights of
 *                     the slide.
 * @param options.cells Pixels per height of the slide.
 * @return Effect.
 */
export const pixels = ( { size = 0.5, cells = 36 }: { size?: number; cells?: number } = {} ): Effect => ( {
	head: NEAR,
	params: { size, cells },
	uv: `
	vec2 grid = vec2( cells * uSize.x / uSize.y, cells );
	vec2 coarse = ( floor( uv * grid ) + 0.5 ) / grid;
	return mix( uv, coarse, step( 0.35, near( coarse, size ) ) );`,
} );
