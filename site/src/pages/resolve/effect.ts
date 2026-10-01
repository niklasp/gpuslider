import type { Effect } from 'gpuslider/effects';

/** The ways a picture can come out, in the order of `mode`. */
export const WAYS = [
	'Pixels',
	'Halftone',
	'Slices',
	'Shards',
	'Dither',
	'Scan',
	'Glyphs',
	'Weave',
	'Ink',
] as const;

/**
 * What the bodies share. The parameters are the bodies', not the head's:
 * they come in. The head cannot look up the picture (`media()` comes after
 * it), so every way is two functions: where to look (`rU…`), and what to
 * make of what is there (`rC…`).
 *
 * Every way cuts a slide into parts: blocks, dots, slices, cells, lines,
 * glyphs, threads, drops of ink. Each part has a time of its own to
 * come out (`late`): mostly by chance, a little from the left and the top.
 * How far the row is, `come`, the page says; what moves fast holds the
 * parts back again (`k`).
 *
 * `z` is how far the picture is in the lightbox, 0 to 1. The lightbox
 * fades the effects of a slide; the page keeps them (see `trace()` in
 * Resolve.tsx) and says how far it is by `uFx`, which it keeps above 0.99.
 * In the lightbox the parts come out once more while it opens, and a
 * trace of the way stays. Every way but Pixels has an edge of its own: in
 * a band at the rim of the picture (`rband_`), narrower in the lightbox.
 */
const HEAD = `
float rhash_( vec2 p ) {
	vec3 q = fract( vec3( p.x, p.y, p.x ) * 0.1031 );
	q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
	return fract( ( q.x + q.y ) * q.z );
}
float rnoise_( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	return mix(
		mix( rhash_( i ), rhash_( i + vec2( 1.0, 0.0 ) ), u.x ),
		mix( rhash_( i + vec2( 0.0, 1.0 ) ), rhash_( i + vec2( 1.0, 1.0 ) ), u.x ),
		u.y
	);
}
float rfbm_( vec2 p ) {
	return rnoise_( p ) * 0.55 + rnoise_( p * 2.1 + 7.0 ) * 0.3 + rnoise_( p * 4.3 + 3.0 ) * 0.15;
}
float rzoom_() {
	return clamp( ( 1.0 - uFx ) * 100.0, 0.0, 1.0 );
}
float rk_( float speed, float z ) {
	return clamp( speed + abs( uVelocity ) * 0.35, 0.0, 1.0 ) * mix( 1.0, 0.35, z );
}
float rat_( vec2 px, float h, float come, float spread, float z ) {
	float x = clamp( ( uQuad.x + px.x ) / uView.x, 0.0, 1.0 );
	float late = h * 0.75 + x * 0.17 + clamp( px.y / uSize.y, 0.0, 1.0 ) * 0.08;
	float r = clamp( come * ( 1.0 + spread ) - late * spread, 0.0, 1.0 );
	// Once more while the lightbox opens or closes.
	return min( r, 1.0 - 0.8 * sin( PI * z ) * ( 0.4 + 0.6 * late ) );
}
float rheld_( float r, float k ) {
	return min( r, 1.0 - k * 0.85 );
}
float rborder_( vec2 p ) {
	return min( min( p.x, p.y ), min( uSize.x - p.x, uSize.y - p.y ) );
}
float rband_( float z ) {
	return min( uSize.x, uSize.y ) * mix( 0.07, 0.022, z );
}
float rlum_( vec3 c ) {
	return dot( c, vec3( 0.3, 0.59, 0.11 ) );
}
vec3 rtint_( vec2 cell ) {
	return mix( vec3( 1.0, 0.3, 0.75 ), vec3( 0.2, 0.8, 1.0 ), rhash_( cell + 3.0 ) );
}
vec4 rdone_( vec3 rgb, float a, float r, vec3 tint, float m ) {
	// The glint: the most while a part is half way.
	float glint = r * ( 1.0 - r ) * 4.0;
	vec3 c = mix( rgb, rgb * tint * 1.25, glint * 0.55 );
	float shown = smoothstep( 0.0, 0.1, r );
	return vec4( c * m * shown, a * m * shown );
}

float rtop_() {
	return floor( log2( max( uSize.y / 6.0, 2.0 ) ) );
}
float rbig_( vec2 uv, float come, float spread, float z ) {
	float big = exp2( rtop_() );
	vec2 cell = floor( uv * uSize / big );
	float h = rhash_( cell + 7.0 ) * 0.7 + rhash_( floor( uv * uSize / ( big * 0.5 ) ) ) * 0.3;
	return rat_( ( cell + 0.5 ) * big, h, come, spread, z );
}
float rblock_( float r, float k ) {
	float top = rtop_();
	return exp2( floor( max( ( 1.0 - r ) * top, k * top * 0.75 ) ) );
}
float rpixel_( vec2 uv, float come, float spread, float k, float z ) {
	float s = rblock_( rbig_( uv, come, spread, z ), k );
	// In the lightbox, the very rim stays a little coarse.
	return rborder_( uv * uSize ) < 6.0 * z ? max( s, 4.0 ) : s;
}
vec2 rU0_( vec2 uv, float come, float spread, float k, float z ) {
	float s = rpixel_( uv, come, spread, k, z );
	return s < 1.5 ? uv : ( floor( uv * uSize / s ) + 0.5 ) * s / uSize;
}
vec4 rC0_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r = rbig_( uv, come, spread, z );
	float s = rpixel_( uv, come, spread, k, z );
	// A fine grid of pixels, in the lightbox.
	vec2 g = step( fract( p / 5.0 ), vec2( 0.2 ) );
	vec3 rgb = c.rgb * ( 1.0 - 0.09 * z * max( g.x, g.y ) );
	return rdone_( rgb, c.a, r, rtint_( floor( p / s ) ), 1.0 );
}

float rdot_() {
	return max( uSize.y / 30.0, 5.0 );
}
float rhalf_( vec2 uv, float come, float spread, float k, float z ) {
	vec2 cell = floor( uv * uSize / rdot_() );
	float h = rhash_( floor( cell / 5.0 ) + 3.0 ) * 0.6 + rhash_( cell ) * 0.4;
	return rheld_( rat_( ( cell + 0.5 ) * rdot_(), h, come, spread, z ), k );
}
vec2 rU1_( vec2 uv, float come, float spread, float k, float z ) {
	float r = rhalf_( uv, come, spread, k, z );
	vec2 c = ( floor( uv * uSize / rdot_() ) + 0.5 ) * rdot_() / uSize;
	return mix( c, uv, smoothstep( 0.75, 1.0, r ) );
}
vec4 rC1_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r = rhalf_( uv, come, spread, k, z );
	vec2 cell = floor( p / rdot_() );
	vec2 centre = ( cell + 0.5 ) * rdot_();
	// The rim is dots that get smaller towards the edge.
	float e = 1.0 - smoothstep( 0.0, rband_( z ), rborder_( centre ) );
	float radius = r * rdot_() * 0.75 * ( 1.0 - e );
	float m = 1.0 - smoothstep( radius - 0.75, radius + 0.75, length( p - centre ) );
	// A fine screen in the shadows, in the lightbox.
	vec2 f = fract( p / 4.0 ) - 0.5;
	float l = rlum_( c.rgb );
	float spot = 1.0 - smoothstep( 0.0, 0.5, length( f ) / max( 1.0 - l, 0.01 ) );
	vec3 rgb = c.rgb * ( 1.0 - z * 0.5 * ( 1.0 - l ) * ( 1.0 - spot ) );
	return rdone_( rgb, c.a, r, rtint_( cell ), m );
}

float rslice_() {
	return max( uSize.y / 26.0, 4.0 );
}
float rsliced_( vec2 uv, float come, float spread, float z ) {
	float s = floor( uv.y * uSize.y / rslice_() );
	float h = rhash_( vec2( s, 5.0 ) ) * 0.8 + rhash_( vec2( floor( s / 4.0 ), 9.0 ) ) * 0.2;
	return rat_( vec2( uSize.x * 0.5, ( s + 0.5 ) * rslice_() ), h, come, spread, z );
}
float rslide_( vec2 uv, float r, float k ) {
	float s = floor( uv.y * uSize.y / rslice_() );
	float side = mod( s, 2.0 ) * 2.0 - 1.0;
	float e = 1.0 - rheld_( r, k );
	return side * ( e * e * 0.8 + k * 0.1 * rhash_( vec2( s, 1.0 ) ) );
}
vec2 rU2_( vec2 uv, float come, float spread, float k, float z ) {
	return vec2( uv.x - rslide_( uv, rsliced_( uv, come, spread, z ), k ), uv.y );
}
vec4 rC2_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r0 = rsliced_( uv, come, spread, z );
	float r = rheld_( r0, k );
	float s = floor( p.y / rslice_() );
	float x = p.x - rslide_( uv, r0, k ) * uSize.x;
	// Ragged ends: each slice a little short of the edge, its own way.
	float b = rband_( z );
	float m = step( rhash_( vec2( s, 11.0 ) ) * b, x ) * step( x, uSize.x - rhash_( vec2( s, 13.0 ) ) * b );
	// Hairlines between a few of them, in the lightbox.
	float hair = step( fract( p.y / rslice_() ) * rslice_(), 1.0 ) * step( 0.7, rhash_( vec2( s, 17.0 ) ) );
	vec3 rgb = c.rgb * ( 1.0 - 0.7 * z * hair );
	return rdone_( rgb, c.a, r, rtint_( vec2( s, 4.0 ) ), m );
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
vec2 rU3_( vec2 uv, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	vec4 v = rvor_( p / rshard_() );
	vec2 c = v.xy * rshard_();
	float e = 1.0 - rheld_( rat_( c, v.z, come, spread, z ), k );
	vec2 away = ( vec2( rhash_( v.xy + 2.0 ), rhash_( v.xy + 5.0 ) ) - 0.5 ) * rshard_() * 0.6;
	return ( c + ( p - c ) / mix( 0.4, 1.0, 1.0 - e * e ) + away * e ) / uSize;
}
vec4 rC3_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	vec4 v = rvor_( p / rshard_() );
	float r = rheld_( rat_( v.xy * rshard_(), v.z, come, spread, z ), k );
	float edge = 1.0 - smoothstep( 0.0, 0.05, v.w );
	vec3 tint = rtint_( floor( v.xy * 7.0 ) );
	// An outline of small cells: those whose middle is too near the rim
	// are not there.
	float b = rband_( z );
	vec4 w = rvor_( p / ( b * 0.9 ) );
	float m = step( b * 0.55, rborder_( w.xy * b * 0.9 ) );
	// The edges catch the light: while a shard comes, and a little in the
	// lightbox.
	vec3 rgb = c.rgb * mix( 0.35, 1.0, r ) + tint * edge * ( r * ( 1.0 - r ) * 3.6 + z * 0.16 );
	return rdone_( rgb, c.a, r, tint, m );
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
vec2 rU4_( vec2 uv, float come, float spread, float k, float z ) {
	float r = rheld_( rbig_( uv, come, spread, z ), k );
	float g = rgrain_( r );
	return r > 0.97 ? uv : ( floor( uv * uSize / g ) + 0.5 ) * g / uSize;
}
vec4 rC4_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r = rheld_( rbig_( uv, come, spread, z ), k );
	float n = 1.0 + floor( r * r * 10.0 );
	float b = rbayer_( p / rgrain_( r ) );
	vec3 q = floor( c.rgb * n + b ) / n;
	vec3 rgb = r > 0.97 ? c.rgb : q;
	// A fine dither in the dark, in the lightbox.
	vec3 fine = floor( c.rgb * 4.0 + rbayer_( p ) ) / 4.0;
	rgb = mix( rgb, fine, z * 0.6 * ( 1.0 - rlum_( c.rgb ) ) );
	// The rim falls off in the dither.
	float m = step( rbayer_( p / 2.0 ), smoothstep( 0.0, rband_( z ), rborder_( p ) ) * 1.01 );
	return rdone_( rgb, c.a, r, rtint_( floor( p / 24.0 ) ), m );
}

float rline_() {
	return max( uSize.y / 160.0, 2.0 );
}
float rscanned_( vec2 uv, float come, float spread, float k, float z ) {
	float ln = floor( uv.y * uSize.y / rline_() );
	float band = floor( ln / 10.0 );
	float h = rhash_( vec2( band, 23.0 ) ) * 0.8 + rhash_( vec2( ln, 29.0 ) ) * 0.2;
	return rheld_( rat_( vec2( uSize.x * 0.5, ( band + 0.5 ) * rline_() * 10.0 ), h, come, spread, z ), k );
}
float rscanoff_( vec2 uv, float r, float k ) {
	float ln = floor( uv.y * uSize.y / rline_() );
	float band = floor( ln / 10.0 );
	float side = rhash_( vec2( band, 31.0 ) ) - 0.5;
	float e = 1.0 - r;
	return side * e * e * 0.7 + k * 0.05 * ( rhash_( vec2( ln, 37.0 ) ) - 0.5 );
}
float rsplit_( vec2 uv, float come, float spread, float k, float z ) {
	float r = rscanned_( uv, come, spread, k, z );
	return ( 1.0 - r ) * 0.03 + k * 0.01 + z * 0.0015;
}
vec2 rU5_( vec2 uv, float come, float spread, float k, float z ) {
	float r = rscanned_( uv, come, spread, k, z );
	return vec2( uv.x - rscanoff_( uv, r, k ), uv.y );
}
vec4 rC5_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r = rscanned_( uv, come, spread, k, z );
	float ln = floor( p.y / rline_() );
	float x = p.x - rscanoff_( uv, r, k ) * uSize.x;
	float b = rband_( z ) * 0.7;
	float m = step( rhash_( vec2( ln, 41.0 ) ) * b, x ) * step( x, uSize.x - rhash_( vec2( ln, 43.0 ) ) * b );
	// Scanlines, strong while a band comes, faint in the lightbox; and the
	// band glows a little.
	float dark = mod( ln, 2.0 );
	vec3 rgb = c.rgb * ( 1.0 - dark * ( mix( 0.65, 0.0, r ) + 0.14 * z ) );
	rgb += vec3( 0.3, 0.55, 1.0 ) * ( 1.0 - r ) * 0.25 * c.a;
	return rdone_( rgb, c.a, r, rtint_( vec2( floor( ln / 10.0 ), 6.0 ) ), m );
}

float rglyphsize_() {
	return max( uSize.y / 34.0, 7.0 );
}
float rglyph_( vec2 q, float level ) {
	vec2 d = abs( q - 0.5 );
	float low = step( length( q - vec2( 0.5, 0.74 ) ), 0.11 );
	float high = step( length( q - vec2( 0.5, 0.3 ) ), 0.11 );
	float plus = max( step( d.x, 0.07 ) * step( d.y, 0.32 ), step( d.y, 0.07 ) * step( d.x, 0.32 ) );
	float grid = max( step( abs( d.x - 0.17 ), 0.06 ), step( abs( d.y - 0.17 ), 0.06 ) ) * step( d.x, 0.36 ) * step( d.y, 0.38 );
	float ring = max( step( abs( length( q - 0.5 ) - 0.3 ), 0.07 ), step( length( q - 0.5 ), 0.1 ) );
	float g = level < 0.5 ? 0.0 : low;
	g = level < 1.5 ? g : max( low, high );
	g = level < 2.5 ? g : plus;
	g = level < 3.5 ? g : grid;
	g = level < 4.5 ? g : ring;
	return g;
}
float rglyphed_( vec2 uv, float come, float spread, float k, float z ) {
	vec2 cell = floor( uv * uSize / rglyphsize_() );
	float h = rhash_( floor( cell / 6.0 ) + 19.0 ) * 0.6 + rhash_( cell + 5.0 ) * 0.4;
	return rheld_( rat_( ( cell + 0.5 ) * rglyphsize_(), h, come, spread, z ), k );
}
vec2 rU6_( vec2 uv, float come, float spread, float k, float z ) {
	float r = rglyphed_( uv, come, spread, k, z );
	vec2 c = ( floor( uv * uSize / rglyphsize_() ) + 0.5 ) * rglyphsize_() / uSize;
	return mix( c, uv, smoothstep( 0.8, 1.0, r ) );
}
vec4 rC6_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r = rglyphed_( uv, come, spread, k, z );
	vec2 cell = floor( p / rglyphsize_() );
	float l = rlum_( c.rgb );
	float g = rglyph_( fract( p / rglyphsize_() ), floor( clamp( l * 1.3, 0.0, 0.999 ) * 6.0 ) );
	vec3 rgb = mix( c.rgb * g * 1.5, c.rgb, smoothstep( 0.75, 1.0, r ) );
	// Glyphs in the shadows, in the lightbox.
	rgb *= 1.0 - z * 0.4 * ( 1.0 - l ) * ( 1.0 - g );
	// At the rim, a glyph here and there is missing.
	float e = 1.0 - smoothstep( 0.0, rband_( z ), rborder_( ( cell + 0.5 ) * rglyphsize_() ) );
	float m = step( e, rhash_( cell + 31.0 ) * 0.999 );
	return rdone_( rgb, c.a, r, rtint_( floor( cell / 6.0 ) ), m );
}

float rthread_() {
	return max( uSize.y / 36.0, 5.0 );
}
// Where the thread on top at this point looks, how far it is, and which
// it is: 1 down, 2 across, 0 none.
vec4 rweave_( vec2 p, float come, float spread, float k, float z ) {
	float t = rthread_();
	float col = floor( p.x / t );
	float row = floor( p.y / t );
	float rv = rheld_( rat_( vec2( ( col + 0.5 ) * t, uSize.y * 0.5 ), rhash_( vec2( col, 21.0 ) ), come, spread, z ), k );
	float rh = rheld_( rat_( vec2( uSize.x * 0.5, ( row + 0.5 ) * t ), rhash_( vec2( row, 37.0 ) ), come, spread, z ), k );
	float ev = 1.0 - rv;
	float eh = 1.0 - rh;
	vec2 pv = p - vec2( 0.0, ev * ev * uSize.y * 0.7 );
	float side = mod( row, 2.0 ) * 2.0 - 1.0;
	vec2 ph = p - vec2( side * eh * eh * uSize.x * 0.7, 0.0 );
	// Frayed: each thread ends short of the edge, its own way.
	float b = rband_( z );
	float okv = step( 0.02, rv ) * step( rhash_( vec2( col, 3.0 ) ) * b, pv.y ) * step( pv.y, uSize.y - rhash_( vec2( col, 5.0 ) ) * b );
	float okh = step( 0.02, rh ) * step( rhash_( vec2( row, 7.0 ) ) * b, ph.x ) * step( ph.x, uSize.x - rhash_( vec2( row, 9.0 ) ) * b );
	float down = step( mod( col + row, 2.0 ), 0.5 );
	vec4 result = vec4( p, 1.0, 0.0 );
	if ( down > 0.5 && okv > 0.5 ) {
		result = vec4( pv, rv, 1.0 );
	} else if ( okh > 0.5 ) {
		result = vec4( ph, rh, 2.0 );
	} else if ( okv > 0.5 ) {
		result = vec4( pv, rv, 1.0 );
	}
	return result;
}
vec2 rU7_( vec2 uv, float come, float spread, float k, float z ) {
	return rweave_( uv * uSize, come, spread, k, z ).xy / uSize;
}
vec4 rC7_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	vec4 w = rweave_( p, come, spread, k, z );
	float r = w.z;
	float across = w.w > 1.5 ? fract( p.y / rthread_() ) : fract( p.x / rthread_() );
	float round_ = mix( 0.5, 1.08, sin( PI * across ) );
	float amount = ( 1.0 - smoothstep( 0.85, 1.0, r ) ) + z * 0.14;
	vec3 rgb = c.rgb * mix( 1.0, round_, clamp( amount, 0.0, 1.0 ) );
	float m = step( 0.5, w.w );
	return rdone_( rgb, c.a, r, rtint_( floor( p / rthread_() ) ), m );
}

float rinked_( vec2 uv, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float h = rfbm_( p / ( uSize.y * 0.3 ) ) * 0.75 + rnoise_( p / ( uSize.y * 0.07 ) ) * 0.25;
	return rheld_( rat_( p, h, come, spread, z ), k );
}
vec2 rU8_( vec2 uv, float come, float spread, float k, float z ) {
	float r = rinked_( uv, come, spread, k, z );
	vec2 n = vec2( rnoise_( uv * 40.0 ), rnoise_( uv * 40.0 + 9.0 ) ) - 0.5;
	return uv + n * ( 1.0 - r ) * 0.02;
}
vec4 rC8_( vec2 uv, vec4 c, float come, float spread, float k, float z ) {
	vec2 p = uv * uSize;
	float r = rinked_( uv, come, spread, k, z );
	// It develops: dark, then grey and hard, then its colours.
	float grey = pow( rlum_( c.rgb ), mix( 2.6, 1.0, r ) );
	vec3 rgb = mix( vec3( grey ) * c.a, c.rgb, smoothstep( 0.45, 1.0, r ) );
	// Where the ink has just come, it is darker.
	rgb *= mix( 0.45, 1.0, smoothstep( 0.0, 0.35, r ) );
	// In the lightbox: a warmer print and a grain.
	rgb = mix( rgb, rgb * vec3( 1.06, 0.98, 0.88 ), 0.45 * z ) + ( rhash_( p ) - 0.5 ) * 0.05 * z * c.a;
	// The rim is where the ink did not quite reach.
	float b = rband_( z );
	float f = rborder_( p ) / b + ( rfbm_( p / ( b * 0.7 ) ) - 0.5 ) * 1.3;
	float m = smoothstep( 0.15, 0.55, f );
	return rdone_( rgb, c.a, r, vec3( 1.0, 0.75, 0.55 ), m );
}`;

/**
 * The pictures come out as they come into view, part by part, each part
 * in its own time, with a glint of colour while it does; what moves fast
 * breaks them up again: the page as it is scrolled (`speed`, 0 to 1, which
 * the page writes), the row as it is dragged. Nine ways, by `mode`, in the
 * order of `WAYS`. In the lightbox a trace of the way stays.
 *
 * @param {Object}   options        Options.
 * @param {number[]} options.come   How far the row has come out, 0 to 1.
 *                                  Written by the page.
 * @param {number[]} options.speed  How fast the page is scrolled, 0 to 1.
 * @param {number[]} options.mode   Which way, 0 to 8.
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
	color: `
	float z = rzoom_();
	float k = rk_( speed, z );
	vec2 o = uv;
	if ( mode < 0.5 ) {
		o = rU0_( uv, come, spread, k, z );
	} else if ( mode < 1.5 ) {
		o = rU1_( uv, come, spread, k, z );
	} else if ( mode < 2.5 ) {
		o = rU2_( uv, come, spread, k, z );
	} else if ( mode < 3.5 ) {
		o = rU3_( uv, come, spread, k, z );
	} else if ( mode < 4.5 ) {
		o = rU4_( uv, come, spread, k, z );
	} else if ( mode < 5.5 ) {
		o = rU5_( uv, come, spread, k, z );
	} else if ( mode < 6.5 ) {
		o = rU6_( uv, come, spread, k, z );
	} else if ( mode < 7.5 ) {
		o = rU7_( uv, come, spread, k, z );
	} else {
		o = rU8_( uv, come, spread, k, z );
	}
	vec4 c = media( o );
	vec4 result = c;
	if ( mode < 0.5 ) {
		result = rC0_( uv, c, come, spread, k, z );
	} else if ( mode < 1.5 ) {
		result = rC1_( uv, c, come, spread, k, z );
	} else if ( mode < 2.5 ) {
		result = rC2_( uv, c, come, spread, k, z );
	} else if ( mode < 3.5 ) {
		result = rC3_( uv, c, come, spread, k, z );
	} else if ( mode < 4.5 ) {
		result = rC4_( uv, c, come, spread, k, z );
	} else if ( mode < 5.5 ) {
		// The colours of a line come apart.
		float e = rsplit_( uv, come, spread, k, z );
		vec4 apart = vec4( media( o + vec2( e, 0.0 ) ).r, c.g, media( o - vec2( e, 0.0 ) ).b, c.a );
		result = rC5_( uv, apart, come, spread, k, z );
	} else if ( mode < 6.5 ) {
		result = rC6_( uv, c, come, spread, k, z );
	} else if ( mode < 7.5 ) {
		result = rC7_( uv, c, come, spread, k, z );
	} else {
		result = rC8_( uv, c, come, spread, k, z );
	}
	return result;`,
} );
