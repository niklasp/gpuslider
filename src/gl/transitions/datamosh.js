import { NOISE } from '../glsl.js';

/**
 * Blocks of the picture jump by random amounts, pushed by its
 * brightness, and flip to the next image at random.
 */
export const datamosh = () => ( {
	head: [ NOISE ],
	transition: `
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float frame = floor( progress * 12.0 );
	vec2 grid = vec2( 18.0, 10.0 ) * ( 1.0 + floor( hash( vec2( frame, 1.0 ) ) * 3.0 ) );
	vec2 cell = floor( uv * grid );
	float r = hash( cell + frame );
	vec4 still = mix( getFromColor( uv ), getToColor( uv ), progress );
	float lum = dot( still.rgb, vec3( 0.3, 0.59, 0.11 ) );
	vec2 jump = ( vec2( r, hash( cell + 3.0 + frame ) ) - 0.5 ) * 0.25 * step( 0.55, r );
	vec2 u = uv + ( jump + vec2( lum - 0.5, 0.0 ) * 0.1 ) * s;
	float m = smoothstep( 0.45, 0.55, progress + ( r - 0.5 ) * 0.5 * s );
	return mix( getFromColor( u ), getToColor( u ), m );
}`,
} );
