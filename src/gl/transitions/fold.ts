/**
 * The image folds away to the left like a page and uncovers the next.
 */
export const fold = () => ( {
	transition: `
vec4 transition( vec2 uv ) {
	float edge = 1.0 - progress;
	if ( uv.x > edge ) {
		// The next image, already in place under the page.
		return getToColor( uv ) * ( 0.6 + 0.4 * smoothstep( edge, edge + 0.25, uv.x ) );
	}
	// The page, squeezed into what is left of it and darker at the crease.
	vec4 c = getFromColor( vec2( uv.x / max( edge, 0.0001 ), uv.y ) );
	float crease = smoothstep( edge - 0.2, edge, uv.x ) * progress;
	return vec4( c.rgb * ( 1.0 - 0.6 * crease ), c.a );
}`,
} );
