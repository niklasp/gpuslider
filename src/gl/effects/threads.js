import { NEAR, NOISE } from '../glsl.js';

// The thread on top at a point, of `n` in the height, woven as cloth is:
// its number, 1 when it runs down and 0 across, and how far across it.
const WOVEN = `
vec3 woven( vec2 uv, float n ) {
	vec2 p = uv * uSize * n / uSize.y;
	vec2 cell = floor( p );
	return mod( cell.x + cell.y, 2.0 ) < 0.5 ? vec3( cell.x, 1.0, fract( p.x ) ) : vec3( cell.y, 0.0, fract( p.y ) );
}`;

/**
 * The image is woven around the pointer: threads that run down and across,
 * over and under each other, each pulled along itself by a length of its
 * own.
 *
 * @param {Object} [options]         Options.
 * @param {number} [options.size]    How far around the pointer, in heights
 *                                   of the slide.
 * @param {number} [options.threads] Threads in the height of the slide.
 * @param {number} [options.amount]  How far a thread is pulled, in heights
 *                                   of the slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const threads = ( { size = 0.5, threads = 30, amount = 0.12 } = {} ) => ( {
	head: [ NEAR, NOISE, WOVEN ],
	params: { size, threads, amount },
	uv: `
	vec3 w = woven( uv, threads );
	float by = ( hash( w.xy ) - 0.5 ) * amount * near( uv, size );
	return uv + ( w.y > 0.5 ? vec2( 0.0, by ) : vec2( by * uSize.y / uSize.x, 0.0 ) );`,
	color: `
	vec3 w = woven( uv, threads );
	return vec4( color.rgb * mix( 1.0, mix( 0.45, 1.1, sin( PI * w.z ) ), near( uv, size ) ), color.a );`,
} );
