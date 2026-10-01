import { NOISE, GLYPH } from '../glsl.js';

/**
 * The image turns into characters, ASCII art of itself, that scramble and
 * settle as the next image: each cell at a time of its own, a little from
 * the left. The characters are made of shapes, no font.
 *
 * @param {Object} [options]       Options.
 * @param {number} [options.cells] Rows of characters in the height.
 * @param {number} [options.tint]  How much the characters glint pink and
 *                                 blue on their way, 0 to 1.
 * @return {import('../program.js').Effect} Effect.
 */
export const glyphs = ( { cells = 32, tint = 0.5 } = {} ) => ( {
	head: [ NOISE, GLYPH ],
	transition: `
vec4 transition( vec2 uv ) {
	float s = resolution.y / ${ ( +cells ).toFixed( 3 ) };
	vec2 cell = floor( uv * resolution / s );
	vec2 c = ( cell + 0.5 ) * s / resolution;
	float h = hash( cell ) * 0.6 + hash( floor( cell / 6.0 ) + 19.0 ) * 0.25 + c.x * 0.15;
	float t = clamp( ( progress - h * 0.55 ) / 0.45, 0.0, 1.0 );
	float a = smoothstep( 0.0, 0.3, t ) * ( 1.0 - smoothstep( 0.7, 1.0, t ) );
	float next = step( 0.5, t );
	vec4 at = mix( getFromColor( c ), getToColor( c ), next );
	// On the way a character is now and then another, by chance.
	float k = floor( t * 9.0 );
	vec3 l = hash( cell + k ) < a * 0.5 ? vec3( hash( cell + k + 7.0 ) ) : at.rgb;
	vec3 glint = mix( vec3( 1.0, 0.3, 0.75 ), vec3( 0.2, 0.8, 1.0 ), hash( cell + 3.0 ) );
	vec3 rgb = at.rgb * glyph( fract( uv * resolution / s ), l ) * 1.5 * mix( vec3( 1.0 ), glint * 1.25, ${ ( +tint ).toFixed( 3 ) } * a );
	return mix( mix( getFromColor( uv ), getToColor( uv ), next ), vec4( rgb, at.a ), a );
}`,
} );
