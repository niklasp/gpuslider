import { NEAR } from '../glsl.js';
import type { Effect } from '../program.js';

/**
 * The colours come apart around the pointer, along its way: the faster it
 * moves, the further.
 *
 * @param options Options.
 * @param options.size How far around the pointer, in heights of
 *                     the slide.
 * @param options.amount How much.
 * @return Effect.
 */
export const shift = ( { size = 0.7, amount = 1 }: { size?: number; amount?: number } = {} ): Effect => ( {
	head: NEAR,
	params: { size, amount },
	color: `
	vec2 d = clamp( uPointerSpeed, vec2( -4.0 ), vec2( 4.0 ) ) * near( uv, size ) * amount * 0.03;
	return vec4( media( uv + d ).r, color.g, media( uv - d ).b, color.a );`,
} );
