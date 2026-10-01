/**
 * Breaks into big pixels and sharpens into the next image.
 */
export const pixelate = () => ( {
	transition: `
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float size = floor( s * s * 48.0 ) + 1.0;
	vec2 cell = size / resolution;
	vec2 p = size > 1.0 ? ( floor( uv / cell ) + 0.5 ) * cell : uv;
	return mix( getFromColor( p ), getToColor( p ), smoothstep( 0.4, 0.6, progress ) );
}`,
} );
