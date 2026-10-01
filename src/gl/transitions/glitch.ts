import { NOISE } from '../glsl.js';

/**
 * Torn scanlines, split colour channels and blocks that switch over
 * at random.
 */
export const glitch = () => ( {
	head: [ NOISE ],
	transition: `
vec4 splitFrom( vec2 uv, float d ) {
	vec4 c = getFromColor( uv );
	return vec4( getFromColor( uv + vec2( d, 0.0 ) ).r, c.g, getFromColor( uv - vec2( d, 0.0 ) ).b, c.a );
}
vec4 splitTo( vec2 uv, float d ) {
	vec4 c = getToColor( uv );
	return vec4( getToColor( uv + vec2( d, 0.0 ) ).r, c.g, getToColor( uv - vec2( d, 0.0 ) ).b, c.a );
}
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float band = floor( uv.y * 18.0 );
	float r = hash( vec2( band, floor( progress * 14.0 ) ) );
	float shift = ( r - 0.5 ) * 0.25 * s * step( 0.55, r );
	vec2 p = vec2( uv.x + shift, uv.y );
	float split = 0.025 * s;
	float block = hash( vec2( floor( uv.x * 8.0 ), band ) );
	float m = smoothstep( block - 0.08, block + 0.08, progress * 1.16 - 0.08 );
	return mix( splitFrom( p, split ), splitTo( p, split ), m );
}`,
} );
