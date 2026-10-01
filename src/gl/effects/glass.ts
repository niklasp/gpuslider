import { NEAR } from '../glsl.js';
import type { Effect } from '../program.js';

/**
 * Fluted glass around the pointer.
 *
 * @param options Options.
 * @param options.size How far around the pointer, in heights of
 *                     the slide.
 * @param options.lines Flutes per width of the slide.
 * @param options.amount How much they bend.
 * @return Effect.
 */
export const glass = ( { size = 0.6, lines = 30, amount = 1 }: { size?: number; lines?: number; amount?: number } = {} ): Effect => ( {
	head: NEAR,
	params: { size, lines, amount },
	uv: `
	float flute = fract( uv.x * lines ) - 0.5;
	uv.x += flute * amount * 0.06 * near( uv, size );
	return uv;`,
} );
