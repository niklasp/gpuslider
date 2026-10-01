import { NEAR } from '../glsl.js';
import type { Effect } from '../program.js';

/**
 * The pointer drags the image along, like a finger in wet paint: the
 * faster, the further.
 *
 * @param options Options.
 * @param options.size How far around the pointer, in heights of
 *                     the slide.
 * @param options.amount How much.
 * @return Effect.
 */
export const smear = ( { size = 0.5, amount = 1 }: { size?: number; amount?: number } = {} ): Effect => ( {
	head: NEAR,
	params: { size, amount },
	uv: `
	vec2 speed = clamp( uPointerSpeed, vec2( -4.0 ), vec2( 4.0 ) );
	return uv - speed * near( uv, size ) * amount * 0.08;`,
} );
