import type { Effect } from '../program.js';

/**
 * The row runs along a wave, and across the view on a slope: a band of
 * slides that rises and falls as it moves.
 *
 * Moves the mesh. Give the slider room above and below.
 *
 * @param options Options.
 * @param options.height How high the wave rises, in heights of
 *                       the view.
 * @param options.length How long a wave is, in widths of the
 *                       view.
 * @param options.slope How much the band rises from left to
 *                      right, px per px.
 * @return Effect.
 */
export const wave = ( { height = 0.12, length = 1.4, slope = -0.25 }: { height?: number; length?: number; slope?: number } = {} ): Effect => ( {
	params: { height, length, slope },
	vertex: `
	float x = uQuad.x + uQuad.z * 0.5 + p.x - uView.x * 0.5;
	float y = height * uView.y * sin( x / ( length * uView.x ) * 2.0 * PI ) + slope * x;
	return vec3( p.x, p.y + y, p.z );`,
} );
