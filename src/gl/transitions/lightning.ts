import { NOISE, ASPECT } from '../glsl.js';
import type { Effect } from '../program.js';

/**
 * Lightning strikes down from the top: the next image opens behind a front
 * of bolts that run out ahead of it, lit blue where they have just been,
 * with a flash now and then.
 *
 * @param options Options.
 * @param options.bolts How many bolts, about, across the image.
 * @param options.tint How blue the light of the front is, 0 to
 *                     1.
 * @return Effect.
 */
export const lightning = ( { bolts = 3, tint = 0.6 }: { bolts?: number; tint?: number } = {} ): Effect => ( {
	head: [ NOISE, ASPECT ],
	transition: `
vec4 transition( vec2 uv ) {
	vec2 a = aspectUv( uv );
	float jolt = floor( progress * 30.0 );
	float d = length( a - vec2( 0.0, -0.62 ) ) / ( 1.25 + abs( a.x ) * 0.2 );
	float n = noise( a * 4.0 ) * 0.6 + noise( a * 13.0 + jolt * 0.71 ) * 0.4;
	float f = progress * 1.45 - 0.2 - d + ( n - 0.5 ) * 0.22;
	float inside = smoothstep( 0.0, 0.01, f );
	vec2 g = a * ${ ( +bolts ).toFixed( 3 ) } + vec2( jolt * 1.37, jolt * 0.53 );
	float e = abs( noise( g + noise( g * 4.0 ) * 0.35 + noise( g * 19.0 ) * 0.07 ) - 0.5 );
	float live = sin( PI * progress );
	float reach = smoothstep( -0.3, 0.0, f ) * ( 1.0 - smoothstep( 0.0, 0.12, f ) ) * live;
	float core = 1.0 - smoothstep( 0.004, 0.012, e );
	float spark = min( ( core + exp( -e * 60.0 ) * 0.5 ) * reach * ( 0.6 + 0.4 * hash( vec2( jolt, 1.0 ) ) ), 1.0 );
	float lit = ( 1.0 - smoothstep( 0.0, 0.18, f ) ) * live * ${ ( +tint ).toFixed( 3 ) };
	float flash = step( 0.8, hash( vec2( jolt, 5.0 ) ) ) * live * 0.3;
	vec4 c = mix( getFromColor( uv ), getToColor( uv ), inside );
	vec3 seen = mix( c.rgb, c.rgb * vec3( 0.75, 0.9, 1.45 ) + vec3( 0.05, 0.08, 0.16 ), lit * inside );
	vec3 bolt = mix( vec3( 0.35, 0.55, 1.0 ), vec3( 0.92, 0.96, 1.0 ), core );
	return vec4( seen + bolt * spark + flash, max( c.a, spark ) );
}`,
} );
