/**
 * Fluted glass: straight vertical ribs, each a small cylinder lens that
 * squeezes and mirrors the picture behind it, with a soft highlight
 * and a dark seam per rib. The glass comes in, the ribs turn to the
 * next image from left to right, and the glass goes again.
 */
export const fluted = () => ( {
	transition: `
vec4 glass( vec2 uv, float m, float blur ) {
	vec4 a = mix( getFromColor( uv ), getToColor( uv ), m );
	vec4 b = mix( getFromColor( uv + vec2( blur, 0.0 ) ), getToColor( uv + vec2( blur, 0.0 ) ), m );
	vec4 c = mix( getFromColor( uv - vec2( blur, 0.0 ) ), getToColor( uv - vec2( blur, 0.0 ) ), m );
	return ( a * 2.0 + b + c ) / 4.0;
}
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	float ribs = max( 8.0, floor( resolution.x / 64.0 ) );
	float x = uv.x * ribs;
	float rib = floor( x );
	float f = fract( x ) - 0.5;
	// Refraction: the picture inside a rib runs the other way, compressed.
	vec2 q = vec2( uv.x - f * 1.7 / ribs * s, uv.y );
	float order = ( rib + 0.5 ) / ribs;
	float m = smoothstep( order - 0.08, order + 0.08, progress * 1.3 - 0.15 );
	vec4 c = glass( q, m, 0.004 * s );
	float highlight = exp( -pow( ( f + 0.25 ) * 9.0, 2.0 ) ) * 0.22 * s;
	float seam = smoothstep( 0.42, 0.5, abs( f ) ) * 0.3 * s;
	return vec4( c.rgb * ( 1.0 - seam ) + highlight * c.a, c.a );
}`,
} );
