import { NEAR } from '../glsl.js';

/**
 * Rings run away from the pointer, as on water.
 *
 * Moves while the pointer is over the slider, and only then.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.size]   How far around the pointer, in heights of
 *                                  the slide.
 * @param {number} [options.amount] How much.
 * @param {number} [options.speed]  How fast the rings run.
 * @return {import('../program.js').Effect} Effect.
 */
export const waves = ( { size = 0.6, amount = 1, speed = 1 } = {} ) => ( {
	head: NEAR,
	params: { size, amount, speed },
	animated: 'pointer',
	uv: `
	vec2 d = ( uv - uPointer ) * vec2( uSize.x / uSize.y, 1.0 );
	float ring = sin( length( d ) * 40.0 - uTime * 6.0 * speed );
	return uv + normalize( d + 0.0001 ) * ring * 0.008 * amount * near( uv, size );`,
} );
