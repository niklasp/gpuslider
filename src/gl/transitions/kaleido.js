import { ASPECT } from '../glsl.js';

/**
 * The image folds into a spinning kaleidoscope and unfolds as the
 * next one.
 */
export const kaleido = () => ( {
	head: [ ASPECT ],
	transition: `
// Spins one way through the whole transition (by progress, not by its
// rise and fall), and is only folded in the middle.
vec2 kaleido( vec2 p, float s ) {
	float seg = PI / 3.0;
	float a = mod( atan( p.y, p.x ) + progress * 4.0, seg );
	a = abs( a - seg / 2.0 );
	vec2 k = length( p ) * vec2( cos( a ), sin( a ) );
	return mix( p, k, smoothstep( 0.0, 0.6, s ) );
}
vec4 transition( vec2 uv ) {
	float s = sin( progress * PI );
	vec2 q = fromAspect( kaleido( aspectUv( uv ) * ( 1.0 - 0.3 * s ), s ) );
	return mix( getFromColor( q ), getToColor( q ), smoothstep( 0.35, 0.65, progress ) );
}`,
} );
