import { NOISE } from '../glsl.js';

/**
 * The image blows away to the right in streaky rows.
 */
export const wind = () => ( {
	head: [ NOISE ],
	transition: `
vec4 transition( vec2 uv ) {
	float size = 0.3;
	float row = floor( uv.y * resolution.y / 2.0 );
	float r = hash( vec2( 0.0, row ) );
	float v = uv.x * ( 1.0 - size ) + size * r - progress * ( 1.0 + size );
	float m = 1.0 - smoothstep( -size, 0.0, v );
	// Streaks only while it blows (none at rest), and never past the
	// image's left edge.
	float streak = ( 1.0 - smoothstep( -size * 0.5, size * 0.5, v ) ) * smoothstep( 0.0, 0.15, progress );
	vec4 from = getFromColor( vec2( max( uv.x - streak * 0.2, 0.0 ), uv.y ) );
	return mix( from, getToColor( uv ), m );
}`,
} );
