import type { Effect } from 'gpuslider/effects';

/**
 * What the bodies share. The parameters are the bodies', not the head's:
 * they come in.
 *
 * A slide is cut into blocks, the largest a sixth of its height. Each
 * block has a time of its own to come out of its pixels (`late`): mostly
 * by chance, from the block it lies in and a little from its own, a
 * little from the left and the top. So the blocks come out in an order of
 * their own, not as a sweep. How far the row is, `come`, the page says.
 */
const HEAD = `
float rhash_( vec2 p ) {
	vec3 q = fract( vec3( p.x, p.y, p.x ) * 0.1031 );
	q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
	return fract( ( q.x + q.y ) * q.z );
}
float rtop_() {
	return floor( log2( max( uSize.y / 6.0, 2.0 ) ) );
}
float resolved_( vec2 uv, float come, float spread ) {
	float big = exp2( rtop_() );
	vec2 cell = floor( uv * uSize / big );
	float h = rhash_( cell + 7.0 ) * 0.7 + rhash_( floor( uv * uSize / ( big * 0.5 ) ) ) * 0.3;
	// A little from the left and from the top first, mostly in no order.
	float x = clamp( ( uQuad.x + ( cell.x + 0.5 ) * big ) / uView.x, 0.0, 1.0 );
	float y = ( cell.y + 0.5 ) * big / uSize.y;
	float late = h * 0.75 + x * 0.17 + y * 0.08;
	return clamp( come * ( 1.0 + spread ) - late * spread, 0.0, 1.0 );
}
float rblock_( float r, float k ) {
	float top = rtop_();
	return exp2( floor( max( ( 1.0 - r ) * top, k * top * 0.75 ) ) );
}
float rspeed_( float speed ) {
	return clamp( speed + abs( uVelocity ) * 0.35, 0.0, 1.0 );
}`;

/**
 * The pictures come out of their pixels as they come into view: coarse
 * blocks first, each of its own time, then finer, then the picture, with
 * a glint of colour while a block resolves. What moves fast breaks up
 * again: the page as it is scrolled (`speed`, 0 to 1, which the page
 * writes), the row as it is dragged.
 *
 * @param {Object}   options        Options.
 * @param {number[]} options.come   How far the row has come out of its
 *                                  pixels, 0 to 1. Written by the page.
 * @param {number[]} options.speed  How fast the page is scrolled, 0 to 1.
 * @param {number}   [options.spread] How far apart the blocks come out.
 */
export const resolve = ( {
	come,
	speed,
	spread = 0.8,
}: {
	come: number[];
	speed: number[];
	spread?: number;
} ): Effect => ( {
	head: HEAD,
	params: { come, speed, spread },
	uv: `
	float r = resolved_( uv, come, spread );
	float s = rblock_( r, rspeed_( speed ) );
	vec2 c = ( floor( uv * uSize / s ) + 0.5 ) * s / uSize;
	return s < 1.5 ? uv : c;`,
	color: `
	float r = resolved_( uv, come, spread );
	float s = rblock_( r, rspeed_( speed ) );
	// The glint: the most while a block is half way.
	float glint = r * ( 1.0 - r ) * 4.0;
	vec3 tint = mix( vec3( 1.0, 0.3, 0.75 ), vec3( 0.2, 0.8, 1.0 ), rhash_( floor( uv * uSize / s ) + 3.0 ) );
	float shown = smoothstep( 0.0, 0.1, r );
	vec3 c = mix( color.rgb, color.rgb * tint * 1.25, glint * 0.55 );
	return vec4( c * shown, color.a * shown );`,
} );
