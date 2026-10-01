import { NOISE } from '../glsl.js';
import type { Effect } from '../program.js';

/**
 * The next image is woven in over the last: its threads come in, down
 * from the top and across from either side, each at a time of its own,
 * over and under each other, and lie flat when they are all there.
 *
 * @param options Options.
 * @param options.threads Threads in the height.
 * @param options.tint How much the threads glint pink and
 *                     blue on their way, 0 to 1.
 * @return Effect.
 */
export const weave = ( { threads = 36, tint = 0.5 }: { threads?: number; tint?: number } = {} ): Effect => ( {
	head: [ NOISE ],
	transition: `
vec4 transition( vec2 uv ) {
	float t = resolution.y / ${ ( +threads ).toFixed( 3 ) };
	vec2 p = uv * resolution;
	vec2 cell = floor( p / t );
	float rv = clamp( progress * 1.7 - hash( vec2( cell.x, 21.0 ) ) * 0.7, 0.0, 1.0 );
	float rh = clamp( progress * 1.7 - hash( vec2( cell.y, 37.0 ) ) * 0.7, 0.0, 1.0 );
	vec2 pv = p - vec2( 0.0, ( 1.0 - rv ) * ( 1.0 - rv ) * 1.05 * resolution.y );
	vec2 ph = p - vec2( ( mod( cell.y, 2.0 ) * 2.0 - 1.0 ) * ( 1.0 - rh ) * ( 1.0 - rh ) * 1.05 * resolution.x, 0.0 );
	float okv = step( 0.0, pv.y ) * step( 0.001, rv );
	float okh = step( 0.0, ph.x ) * step( ph.x, resolution.x ) * step( 0.001, rh );
	// The thread on top: down where the cells say so, across, or none.
	float down = step( mod( cell.x + cell.y, 2.0 ), 0.5 );
	float way = down * okv > 0.5 ? 1.0 : ( okh > 0.5 ? 2.0 : okv );
	float r = way > 1.5 ? rh : rv;
	vec4 to = getToColor( ( way > 1.5 ? ph : pv ) / resolution );
	// Round while it moves, flat when it is there.
	float across = fract( ( way > 1.5 ? p.y : p.x ) / t );
	float shade = mix( 1.0, mix( 0.5, 1.08, sin( PI * across ) ), 1.0 - smoothstep( 0.8, 1.0, r ) );
	vec3 glint = mix( vec3( 1.0, 0.3, 0.75 ), vec3( 0.2, 0.8, 1.0 ), hash( cell + 3.0 ) );
	vec3 rgb = to.rgb * shade * mix( vec3( 1.0 ), glint * 1.25, ${ ( +tint ).toFixed( 3 ) } * r * ( 1.0 - r ) * 4.0 );
	vec4 from = getFromColor( uv );
	return way > 0.5 ? vec4( rgb, to.a ) : vec4( from.rgb * ( 1.0 - 0.4 * progress ), from.a );
}`,
} );
