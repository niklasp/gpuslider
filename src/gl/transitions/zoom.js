/**
 * Zooms into the image with a radial blur, then out of the next one.
 */
export const zoom = () => ( {
	transition: `
vec4 zoomed( vec2 uv, float zoom, float blur, bool to ) {
	vec4 sum = vec4( 0.0 );
	for ( int i = 0; i < 10; i++ ) {
		float t = float( i ) / 9.0;
		vec2 u = 0.5 + ( uv - 0.5 ) / ( zoom * ( 1.0 + blur * t ) );
		sum += to ? getToColor( u ) : getFromColor( u );
	}
	return sum / 10.0;
}
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float zoom = 1.0 + 2.0 * s * s;
	float blur = 0.25 * s;
	vec4 from = zoomed( uv, zoom, blur, false );
	vec4 to = zoomed( uv, zoom, blur, true );
	return mix( from, to, smoothstep( 0.4, 0.6, progress ) );
}`,
} );
