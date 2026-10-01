/**
 * Both images zoom out while the next one pushes the current one
 * aside, with a small gap between them.
 */
export const push = () => ( {
	transition: `
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	vec2 c = ( uv - 0.5 ) / ( 1.0 - 0.3 * s ) + 0.5;
	// Around and between the images: the page shows through.
	vec4 back = vec4( 0.0 );
	if ( c.y < 0.0 || c.y > 1.0 ) {
		return back;
	}
	float gap = 0.05 * s;
	float x = c.x + progress * ( 1.0 + gap );
	if ( x < 1.0 && c.x >= 0.0 ) {
		return getFromColor( vec2( x, c.y ) );
	}
	if ( x > 1.0 + gap && c.x <= 1.0 ) {
		return getToColor( vec2( x - 1.0 - gap, c.y ) );
	}
	return back;
}`,
} );
