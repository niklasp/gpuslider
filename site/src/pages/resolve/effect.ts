import type { Effect } from 'gpuslider/effects';

/** The ways a picture can come out, in the order of `mode`. */
export const WAYS = [ 'Pixels', 'Halftone', 'Slices', 'Shards', 'Dither' ] as const;

/**
 * What the bodies share. The parameters are the bodies', not the head's:
 * they come in.
 *
 * Every way cuts a slide into parts: blocks, dots, slices, shards. Each
 * part has a time of its own to come out (`late`): mostly by chance, a
 * little from the left and the top. So the parts come out in an order of
 * their own, not as a sweep. How far the row is, `come`, the page says;
 * what moves fast (`speed` of the page, the speed of the row) holds the
 * parts back again.
 */
const HEAD = `
float rhash_( vec2 p ) {
	vec3 q = fract( vec3( p.x, p.y, p.x ) * 0.1031 );
	q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
	return fract( ( q.x + q.y ) * q.z );
}
float rspeed_( float speed ) {
	return clamp( speed + abs( uVelocity ) * 0.35, 0.0, 1.0 );
}
float rat_( vec2 px, float h, float come, float spread ) {
	float x = clamp( ( uQuad.x + px.x ) / uView.x, 0.0, 1.0 );
	float late = h * 0.75 + x * 0.17 + clamp( px.y / uSize.y, 0.0, 1.0 ) * 0.08;
	return clamp( come * ( 1.0 + spread ) - late * spread, 0.0, 1.0 );
}
float rheld_( float r, float k ) {
	return min( r, 1.0 - k * 0.85 );
}
float rtop_() {
	return floor( log2( max( uSize.y / 6.0, 2.0 ) ) );
}
float rbig_( vec2 uv, float come, float spread ) {
	float big = exp2( rtop_() );
	vec2 cell = floor( uv * uSize / big );
	float h = rhash_( cell + 7.0 ) * 0.7 + rhash_( floor( uv * uSize / ( big * 0.5 ) ) ) * 0.3;
	return rat_( ( cell + 0.5 ) * big, h, come, spread );
}
float rblock_( float r, float k ) {
	float top = rtop_();
	return exp2( floor( max( ( 1.0 - r ) * top, k * top * 0.75 ) ) );
}
float rdot_() {
	return max( uSize.y / 30.0, 5.0 );
}
float rhalf_( vec2 uv, float come, float spread ) {
	vec2 cell = floor( uv * uSize / rdot_() );
	float h = rhash_( floor( cell / 5.0 ) + 3.0 ) * 0.6 + rhash_( cell ) * 0.4;
	return rat_( ( cell + 0.5 ) * rdot_(), h, come, spread );
}
float rslice_() {
	return max( uSize.y / 26.0, 4.0 );
}
float rsliced_( vec2 uv, float come, float spread ) {
	float s = floor( uv.y * uSize.y / rslice_() );
	float h = rhash_( vec2( s, 5.0 ) ) * 0.8 + rhash_( vec2( floor( s / 4.0 ), 9.0 ) ) * 0.2;
	return rat_( vec2( uSize.x * 0.5, ( s + 0.5 ) * rslice_() ), h, come, spread );
}
float rslide_( vec2 uv, float r, float k ) {
	float s = floor( uv.y * uSize.y / rslice_() );
	float side = mod( s, 2.0 ) * 2.0 - 1.0;
	float e = 1.0 - rheld_( r, k );
	return side * ( e * e * 0.8 + k * 0.1 * rhash_( vec2( s, 1.0 ) ) );
}
float rshard_() {
	return uSize.y / 4.5;
}
vec4 rvor_( vec2 q ) {
	vec2 i = floor( q );
	float d1 = 9.0;
	float d2 = 9.0;
	vec2 best = vec2( 0.0 );
	for ( int y = -1; y <= 1; y++ ) {
		for ( int x = -1; x <= 1; x++ ) {
			vec2 c = i + vec2( float( x ), float( y ) );
			vec2 o = c + vec2( rhash_( c ), rhash_( c + 17.0 ) ) * 0.8 + 0.1;
			float d = length( q - o );
			if ( d < d1 ) {
				d2 = d1;
				d1 = d;
				best = o;
			} else if ( d < d2 ) {
				d2 = d;
			}
		}
	}
	return vec4( best, rhash_( floor( best * 7.0 ) ), d2 - d1 );
}
float rb2_( vec2 a ) {
	vec2 b = floor( a );
	return fract( b.x / 2.0 + b.y * b.y * 0.75 );
}
float rbayer_( vec2 a ) {
	return rb2_( a * 0.5 ) * 0.25 + rb2_( a );
}
float rgrain_( float r ) {
	return exp2( floor( ( 1.0 - r ) * 2.99 ) + 1.0 );
}
vec3 rtint_( vec2 cell ) {
	return mix( vec3( 1.0, 0.3, 0.75 ), vec3( 0.2, 0.8, 1.0 ), rhash_( cell + 3.0 ) );
}`;

/**
 * The pictures come out as they come into view, part by part, each part
 * in its own time, with a glint of colour while it does; what moves fast
 * breaks them up again: the page as it is scrolled (`speed`, 0 to 1, which
 * the page writes), the row as it is dragged. Five ways, by `mode`:
 *
 * 0. Pixels: coarse blocks, then finer, then the picture.
 * 1. Halftone: dots of a screen print that grow until they are the picture.
 * 2. Slices: thin slices that come in from either side and lock in place.
 * 3. Shards: cells that come forward out of the dark, their edges lit.
 * 4. Dither: a few colours in an ordered dither, then more, then all.
 *
 * @param {Object}   options        Options.
 * @param {number[]} options.come   How far the row has come out, 0 to 1.
 *                                  Written by the page.
 * @param {number[]} options.speed  How fast the page is scrolled, 0 to 1.
 * @param {number[]} options.mode   Which way, 0 to 4.
 * @param {number}   [options.spread] How far apart the parts come out.
 */
export const resolve = ( {
	come,
	speed,
	mode,
	spread = 0.8,
}: {
	come: number[];
	speed: number[];
	mode: number[];
	spread?: number;
} ): Effect => ( {
	head: HEAD,
	params: { come, speed, mode, spread },
	uv: `
	float k = rspeed_( speed );
	vec2 p = uv * uSize;
	vec2 o = uv;
	if ( mode < 0.5 ) {
		float s = rblock_( rbig_( uv, come, spread ), k );
		vec2 c = ( floor( p / s ) + 0.5 ) * s / uSize;
		o = s < 1.5 ? uv : c;
	} else if ( mode < 1.5 ) {
		float r = rheld_( rhalf_( uv, come, spread ), k );
		vec2 c = ( floor( p / rdot_() ) + 0.5 ) * rdot_() / uSize;
		o = mix( c, uv, smoothstep( 0.75, 1.0, r ) );
	} else if ( mode < 2.5 ) {
		o = vec2( uv.x - rslide_( uv, rsliced_( uv, come, spread ), k ), uv.y );
	} else if ( mode < 3.5 ) {
		vec4 v = rvor_( p / rshard_() );
		vec2 c = v.xy * rshard_();
		float r = rheld_( rat_( c, v.z, come, spread ), k );
		float e = 1.0 - r;
		vec2 away = ( vec2( rhash_( v.xy + 2.0 ), rhash_( v.xy + 5.0 ) ) - 0.5 ) * rshard_() * 0.6;
		vec2 q = c + ( p - c ) / mix( 0.4, 1.0, 1.0 - e * e ) + away * e;
		o = q / uSize;
	} else {
		float r = rheld_( rbig_( uv, come, spread ), k );
		float g = rgrain_( r );
		vec2 c = ( floor( p / g ) + 0.5 ) * g / uSize;
		o = r > 0.97 ? uv : c;
	}
	return o;`,
	color: `
	float k = rspeed_( speed );
	vec2 p = uv * uSize;
	vec3 rgb = color.rgb;
	float m = 1.0;
	float r = 1.0;
	vec3 tint = vec3( 1.0 );
	if ( mode < 0.5 ) {
		r = rbig_( uv, come, spread );
		float s = rblock_( r, k );
		tint = rtint_( floor( p / s ) );
	} else if ( mode < 1.5 ) {
		r = rheld_( rhalf_( uv, come, spread ), k );
		vec2 cell = floor( p / rdot_() );
		float d = length( p - ( cell + 0.5 ) * rdot_() );
		float radius = r * rdot_() * 0.75;
		m = 1.0 - smoothstep( radius - 0.75, radius + 0.75, d );
		tint = rtint_( cell );
	} else if ( mode < 2.5 ) {
		float r0 = rsliced_( uv, come, spread );
		r = rheld_( r0, k );
		float u = uv.x - rslide_( uv, r0, k );
		m = step( 0.0, u ) * step( u, 1.0 );
		tint = rtint_( vec2( floor( p.y / rslice_() ), 4.0 ) );
	} else if ( mode < 3.5 ) {
		vec4 v = rvor_( p / rshard_() );
		r = rheld_( rat_( v.xy * rshard_(), v.z, come, spread ), k );
		float edge = 1.0 - smoothstep( 0.0, 0.05, v.w );
		tint = rtint_( floor( v.xy * 7.0 ) );
		rgb = rgb * mix( 0.35, 1.0, r ) + tint * edge * r * ( 1.0 - r ) * 4.0 * 0.9;
	} else {
		r = rheld_( rbig_( uv, come, spread ), k );
		float n = 1.0 + floor( r * r * 10.0 );
		float b = rbayer_( p / rgrain_( r ) );
		vec3 q = floor( rgb * n + b ) / n;
		rgb = r > 0.97 ? rgb : q;
		tint = rtint_( floor( p / 24.0 ) );
	}
	// The glint: the most while a part is half way.
	float glint = r * ( 1.0 - r ) * 4.0;
	rgb = mix( rgb, rgb * tint * 1.25, glint * 0.55 );
	float shown = smoothstep( 0.0, 0.1, r );
	return vec4( rgb * m * shown, color.a * m * shown );`,
} );
