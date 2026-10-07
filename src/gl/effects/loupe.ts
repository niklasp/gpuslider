import type { Effect } from '../program.js';

/**
 * A loupe that the pointer carries over the whole slider: it magnifies the
 * gaps and the borders of the slides as it does the pictures, and has a
 * rim of glass. Drawn by the post pass, over all slides at once.
 *
 * @param options Options.
 * @param options.size Radius, px.
 * @param options.strength 0 is no lens, 0.5 doubles the size in its
 *                         middle.
 * @return Effect.
 */
export const loupe = ( { size = 90, strength = 0.4 }: { size?: number; strength?: number } = {} ): Effect => ( {
	params: { size, strength },
	post: `
	vec2 d = uv * uView - uPointer;
	float far = length( d ) / size;
	float lens = pow( 1.0 - smoothstep( 0.0, 1.0, far ), 2.0 ) * uPointerIn;
	float rim = smoothstep( 0.9, 0.97, far ) * ( 1.0 - smoothstep( 0.97, 1.04, far ) ) * uPointerIn;
	return scene( uv - d / uView * lens * strength ) * ( 1.0 - rim * 0.3 ) + vec4( 0.3 ) * rim;`,
} );
