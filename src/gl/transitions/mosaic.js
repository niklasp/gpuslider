import { NOISE } from '../glsl.js';

/**
 * The image breaks into tiles that shrink, each at its own time, and
 * come back as the next image.
 */
export const mosaic = () => ( {
	head: [ NOISE ],
	transition: `
vec4 transition( vec2 uv ) {
	vec2 grid = vec2( floor( 10.0 * resolution.x / resolution.y + 0.5 ), 10.0 );
	vec2 cell = floor( uv * grid );
	vec2 local = fract( uv * grid ) - 0.5;
	float delay = hash( cell ) * 0.4;
	float t = clamp( ( progress - delay ) / 0.6, 0.0, 1.0 );
	float s = sin( t * PI );
	float scale = 1.0 - 0.85 * s;
	vec2 q = local / scale;
	if ( abs( q.x ) > 0.5 || abs( q.y ) > 0.5 ) {
		// Between the tiles: both images, dimmed.
		vec4 back = mix( getFromColor( uv ), getToColor( uv ), progress );
		return vec4( back.rgb * 0.35, back.a );
	}
	vec2 u = ( cell + 0.5 + q ) / grid;
	return t < 0.5 ? getFromColor( u ) : getToColor( u );
}`,
} );
