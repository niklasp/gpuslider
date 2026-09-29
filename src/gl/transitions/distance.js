/**
 * Where the two images are alike, the next is there first; where they
 * differ most, last. At the end the rest fades over.
 *
 * ColourDistance of gl-transitions.com, by P-Seebauer, MIT.
 */
export const distance = () => ( {
	transition: `
vec4 transition( vec2 uv ) {
	vec4 a = getFromColor( uv );
	vec4 b = getToColor( uv );
	float m = step( distance( a, b ), progress );
	return mix( mix( a, b, m ), b, pow( progress, 5.0 ) );
}`,
} );
