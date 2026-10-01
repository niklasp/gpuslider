import type { Effect } from '../program.js';

/**
 * The colours come apart along the way of the slider, the faster the
 * further.
 *
 * @param options Options.
 * @param options.amount How much.
 * @return Effect.
 */
export const split = ( { amount = 1 }: { amount?: number } = {} ): Effect => ( {
	params: { amount },
	color: `
	vec2 d = vec2( clamp( uVelocity, -6.0, 6.0 ) * amount * 0.004, 0.0 );
	return vec4( media( uv + d ).r, color.g, media( uv - d ).b, color.a );`,
} );
