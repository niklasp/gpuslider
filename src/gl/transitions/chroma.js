/**
 * Each image's colours bend the other's pixels half way.
 */
export const chroma = () => ( {
	transition: `
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	vec4 a = getFromColor( uv );
	vec4 b = getToColor( uv );
	float k = 0.3 * s * s;
	vec4 from = getFromColor( mix( uv, b.rg, k ) );
	vec4 to = getToColor( mix( uv, a.gb, k ) );
	return mix( from, to, smoothstep( 0.3, 0.7, progress ) );
}`,
} );
