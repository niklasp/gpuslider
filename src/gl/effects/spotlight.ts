import type { Effect } from '../program.js';

/**
 * The image is dimmed while the pointer is over the slider, except around
 * the pointer.
 *
 * @param options Options.
 * @param options.size Radius, in heights of the slide.
 * @param options.dim How dark the rest is, 0 to 1.
 * @return Effect.
 */
export const spotlight = ( { size = 0.5, dim = 0.45 }: { size?: number; dim?: number } = {} ): Effect => ( {
	params: { size, dim },
	color: `
	vec2 d = ( uv - uPointer ) * vec2( uSize.x / uSize.y, 1.0 ) / size;
	float light = exp( -dot( d, d ) );
	float level = mix( 1.0 - dim, 1.1, light );
	return vec4( color.rgb * mix( 1.0, level, uPointerIn ), color.a );`,
} );
