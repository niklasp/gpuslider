import { NEAR, NOISE, GLYPH } from '../glsl.js';
import type { Effect } from '../program.js';

// Whether a cell around the pointer is a character: the nearer, the more
// likely, so that the rim is ragged.
const ON = `
float asciiOn( vec2 uv, float size, float cells ) {
	float s = uSize.y / cells;
	vec2 cell = floor( uv * uSize / s );
	return step( 0.15 + 0.6 * hash( cell + 11.0 ), near( ( cell + 0.5 ) * s / uSize, size ) );
}`;

/**
 * ASCII art around the pointer: the image turns into characters, as light
 * as the image is where they are. The characters are made of shapes, no
 * font.
 *
 * @param options Options.
 * @param options.size How far around the pointer, in heights of
 *                     the slide.
 * @param options.cells Rows of characters in the height of the
 *                      slide.
 * @return Effect.
 */
export const ascii = ( { size = 0.5, cells = 30 }: { size?: number; cells?: number } = {} ): Effect => ( {
	head: [ NEAR, NOISE, GLYPH, ON ],
	params: { size, cells },
	uv: `
	float s = uSize.y / cells;
	return asciiOn( uv, size, cells ) > 0.5 ? ( floor( uv * uSize / s ) + 0.5 ) * s / uSize : uv;`,
	color: `
	float g = glyph( fract( uv * uSize * cells / uSize.y ), color.rgb );
	// Between the characters the image is dark, not gone.
	return mix( color, vec4( color.rgb * mix( 0.3, 1.6, g ), color.a ), asciiOn( uv, size, cells ) );`,
} );
