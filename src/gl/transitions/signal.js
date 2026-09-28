import { NOISE } from '../glsl.js';

/**
 * An analog signal breaking up: jittering lines, a rolling bar,
 * colour offsets and scanlines, strongest half way.
 */
export const signal = () => ( {
	head: [ NOISE ],
	transition: `
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float frame = floor( progress * 24.0 );
	float line = floor( uv.y * resolution.y / 3.0 );
	float jitter = ( hash( vec2( line, frame ) ) - 0.5 ) * 0.04 * s;
	float roll = fract( uv.y - progress * 2.0 );
	float bar = smoothstep( 0.0, 0.05, roll ) * ( 1.0 - smoothstep( 0.05, 0.15, roll ) );
	float wave = sin( uv.y * 40.0 + progress * 60.0 ) * 0.01 * s;
	vec2 u = vec2( uv.x + jitter + wave + bar * 0.05 * s, uv.y );
	float split = 0.012 * s;
	float m = smoothstep( 0.45, 0.55, progress + ( hash( vec2( frame, 3.0 ) ) - 0.5 ) * 0.2 * s );
	vec4 a = getFromColor( u );
	vec4 b = getToColor( u );
	vec4 c = mix( a, b, m );
	float r = mix( getFromColor( u + vec2( split, 0.0 ) ).r, getToColor( u + vec2( split, 0.0 ) ).r, m );
	float bl = mix( getFromColor( u - vec2( split, 0.0 ) ).b, getToColor( u - vec2( split, 0.0 ) ).b, m );
	float scan = 1.0 - 0.18 * s * step( 0.5, fract( uv.y * resolution.y / 4.0 ) );
	return vec4( vec3( r, c.g, bl ) * scan + bar * 0.08 * s * c.a, c.a );
}`,
} );
