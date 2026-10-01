/**
 * The two effects of the index, in eleven ways to choose from:
 *
 *     0  Burn       a hole that burns open from the pointer and stays one,
 *                   its edge alive with fire; the next picture burns in
 *     1  Smoke      the picture forms out of curling, rising smoke that
 *                   keeps curling at its edge; the next comes in a puff
 *     2  Liquid     a drop that swells from the pointer and bends the
 *                   picture at its edge; the next lands in rings
 *     3  Shatter    shards that fly in and lock together; the next one
 *                   shatters in
 *     4  Pixels     blocks from the pointer outward, coarse then fine; the
 *                   next coarsens and comes back
 *     5  Blinds     slats that open one after the other; the next is on
 *                   their backs as they turn
 *     6  Lightning  bolts that strike out ahead of the picture; the next
 *                   strikes in, with a flash
 *     7  Frost      the picture thaws out of ice, crystals glinting at its
 *                   edge; the next ices over and thaws
 *     8  Halftone   dots of print, red, green and blue, that grow until
 *                   they run together; the next comes through the dots
 *     9  Thermal    the picture comes up through a heat camera and cools
 *                   into its colours; the next heats up and cools
 *    10  Swirl      the picture turns out of a whirl at the pointer; the
 *                   next whirls out of it
 *
 * `veil()` lets the picture appear at the pointer and drags it behind the
 * pointer; `turn()` is the transition of the stack from one name to the
 * next. What they read is written by the page on every frame (`VEIL`).
 *
 * Their helpers have names of their own: the effects of the library have
 * theirs, and a page can have both.
 */
const HEAD = `
float veilHash_( vec2 p ) {
	vec3 q = fract( vec3( p.x, p.y, p.x ) * 0.1031 );
	q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
	return fract( ( q.x + q.y ) * q.z );
}
float veilNoise_( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	return mix(
		mix( veilHash_( i ), veilHash_( i + vec2( 1.0, 0.0 ) ), u.x ),
		mix( veilHash_( i + vec2( 0.0, 1.0 ) ), veilHash_( i + vec2( 1.0, 1.0 ) ), u.x ),
		u.y
	);
}
vec4 veilShards_( vec2 p ) {
	vec2 cell = floor( p );
	vec2 best = vec2( 0.0 );
	float d1 = 9.0;
	float d2 = 9.0;
	for ( int j = 0; j < 3; j++ ) {
		for ( int i = 0; i < 3; i++ ) {
			vec2 c = cell + vec2( float( i ) - 1.0, float( j ) - 1.0 );
			vec2 s = c + vec2( veilHash_( c ), veilHash_( c + 19.19 ) ) * 0.85 + 0.075;
			float d = length( p - s );
			float was = d1;
			if ( d < d1 ) {
				d1 = d;
				best = s;
			}
			d2 = min( d2, max( d, was ) );
		}
	}
	return vec4( best, d1, d2 - d1 );
}
float veilSmin_( float a, float b, float k ) {
	float h = clamp( 0.5 + 0.5 * ( b - a ) / k, 0.0, 1.0 );
	return mix( b, a, h ) - k * h * ( 1.0 - h );
}
vec3 veilCell_( vec2 a, float turn, float n ) {
	float cs = cos( turn );
	float sn = sin( turn );
	vec2 r = vec2( cs * a.x + sn * a.y, cs * a.y - sn * a.x ) * n;
	vec2 mid = ( floor( r ) + 0.5 ) / n;
	return vec3( cs * mid.x - sn * mid.y, sn * mid.x + cs * mid.y, length( fract( r ) - 0.5 ) );
}
vec3 veilHeat_( float x ) {
	vec3 a = mix( vec3( 0.02, 0.0, 0.12 ), vec3( 0.42, 0.0, 0.62 ), smoothstep( 0.0, 0.3, x ) );
	a = mix( a, vec3( 0.95, 0.12, 0.1 ), smoothstep( 0.25, 0.55, x ) );
	a = mix( a, vec3( 1.0, 0.72, 0.0 ), smoothstep( 0.5, 0.8, x ) );
	return mix( a, vec3( 1.0, 1.0, 0.9 ), smoothstep( 0.82, 1.0, x ) );
}`;

/** The way: 0 to 10, as above. */
export const STYLE = [ 0 ];

/**
 * What the page writes into on every frame: how far the picture is open
 * (0 to 1), where in it the pointer is (in its uv), how far it lags
 * behind the pointer (px, right and down), and a clock that runs while it
 * is shown, and how much of the quad is room around the picture, in
 * its uv.
 */
export const VEIL = {
	open: [ 0 ],
	centre: [ 0.5, 0.5 ],
	drift: [ 0, 0 ],
	clock: [ 0 ],
	pad: [ 0.05, 0.05 ],
	style: STYLE,
};

/** The picture appears at the pointer, and trails it. */
export const veil = () => ( {
	head: HEAD,
	params: VEIL,
	// The side away from where the pointer goes stays behind, as if the
	// picture were dragged by its front edge.
	vertex: `
	vec2 d = vec2( drift.x, drift.y );
	float speed = length( d );
	vec2 way = speed > 0.001 ? d / speed : vec2( 1.0, 0.0 );
	float behind = 0.5 - dot( uv - 0.5, way );
	float across = dot( uv - 0.5, vec2( -way.y, way.x ) );
	float sail = 0.45 + 0.55 * ( 1.0 - 4.0 * across * across );
	vec2 off = -d * behind * sail * 1.1;
	return vec3( p.x + off.x, p.y - off.y, p.z );`,
	color: `
	float k = uSize.x / uSize.y;
	vec2 c = vec2( centre.x, centre.y );
	vec2 q = ( uv - c ) * vec2( k, 1.0 );
	float d = length( q );
	vec2 dir = d > 0.0001 ? q / d : vec2( 0.0 );
	float o = open;
	if ( style < 0.5 ) {
		// Burn: a hole that burns open from the pointer and stays a hole,
		// short of the edges of the picture, its edge alive with fire.
		// Where in the picture, -1 to 1 from its middle, and how far in
		// from a round outline that keeps clear of its edges.
		vec2 qn = ( uv - 0.5 ) / ( vec2( 0.5 ) - vec2( pad.x, pad.y ) );
		float rim = ( 1.0 - length( qn * vec2( 0.92, 1.0 ) ) ) * 0.4;
		float t = clock;
		vec2 a = uv * vec2( k, 1.0 );
		float n = veilNoise_( a * 3.0 + vec2( t * 0.3, -t * 0.2 ) ) * 0.5 + veilNoise_( a * 8.0 - vec2( t * 0.5, t * 0.35 ) ) * 0.3 + veilNoise_( a * 22.0 + vec2( t, 0.0 ) ) * 0.2;
		float margin = 0.07 + sin( t * 1.4 ) * 0.008 + ( 1.0 - o ) * 0.3;
		float f = veilSmin_( o * 1.1 - 0.12 - d, rim - margin, 0.14 ) + ( n - 0.5 ) * 0.16;
		// Little holes burnt through, away from the middle, and the char
		// around them.
		float away = smoothstep( 0.25, 0.75, length( qn ) );
		float spot = veilNoise_( a * 7.0 + vec2( 31.0, 17.0 ) ) * 0.7 + veilNoise_( a * 19.0 ) * 0.3;
		float hole = smoothstep( 0.76, 0.79, spot ) * away;
		float holeRim = ( smoothstep( 0.66, 0.77, spot ) - hole ) * away * smoothstep( 0.0, 0.03, f );
		float inside = smoothstep( 0.0, 0.01, f ) * ( 1.0 - hole );
		float flick = 0.7 + 0.3 * veilNoise_( vec2( t * 7.0, d * 9.0 ) );
		float live = smoothstep( 0.0, 0.04, o );
		float edge = ( 1.0 - smoothstep( 0.0, 0.026, abs( f ) ) ) * live * flick;
		// Soot that creeps in from the rim, uneven, and the heat before it.
		float creep = 0.07 + 0.12 * veilNoise_( a * 5.0 - vec2( 0.0, t * 0.05 ) );
		float soot = ( 1.0 - smoothstep( 0.0, creep, f ) ) * 0.9;
		float heat = ( 1.0 - smoothstep( 0.0, creep + 0.12, f ) ) * 0.45;
		vec3 warm = color.rgb * vec3( 1.25, 0.85, 0.55 );
		vec3 seen = mix( color.rgb, warm, heat );
		seen = mix( seen, vec3( 0.07, 0.04, 0.02 ) * color.a, max( soot, holeRim * 0.85 ) );
		// Embers that drift up and flicker.
		vec2 g = a * 16.0 + vec2( 0.0, t * 0.9 );
		vec2 cell = floor( g );
		float h = veilHash_( cell );
		vec2 at = fract( g ) - 0.5 - ( vec2( veilHash_( cell + 3.1 ), veilHash_( cell + 7.7 ) ) - 0.5 ) * 0.6;
		float ember = step( 0.9, h ) * exp( -dot( at, at ) * 90.0 ) * ( 0.5 + 0.5 * sin( t * ( 6.0 + h * 9.0 ) + h * 40.0 ) ) * ( 0.35 + away ) * live;
		float holeGlow = ( 1.0 - smoothstep( 0.0, 0.03, abs( spot - 0.765 ) ) ) * away * flick * live;
		float within = smoothstep( 0.0, 0.03, f );
		float glow = max( edge, max( ember, holeGlow * 0.8 ) * within );
		vec3 fire = mix( vec3( 1.0, 0.2, 0.03 ), vec3( 1.0, 0.88, 0.55 ), glow * glow );
		return vec4( seen * inside + fire * glow * 1.25 * color.a, max( color.a * inside, glow * color.a ) );
	}
	if ( style < 1.5 ) {
		// Smoke: the picture forms out of smoke that curls and rises from
		// the pointer, and keeps curling at its edge; thick at the edge, it
		// thins to clear in the middle and stays short of the picture's edges.
		vec2 qn = ( uv - 0.5 ) / ( vec2( 0.5 ) - vec2( pad.x, pad.y ) );
		float rim = ( 1.0 - length( qn * vec2( 0.92, 1.0 ) ) ) * 0.4;
		float t = clock;
		vec2 a = uv * vec2( k, 1.0 );
		// Noise that bends noise that bends noise, all of it drifting up.
		vec2 w1 = vec2( veilNoise_( a * 3.0 + vec2( 0.0, t * 0.35 ) ), veilNoise_( a * 3.0 + vec2( 5.2 - t * 0.25, 1.3 + t * 0.2 ) ) );
		vec2 w2 = vec2( veilNoise_( a * 4.0 + w1 * 3.0 + vec2( t * 0.2, t * 0.3 ) ), veilNoise_( a * 4.0 + w1 * 3.0 + vec2( 8.3, 2.8 + t * 0.4 ) ) );
		float n = veilNoise_( a * 3.5 + w2 * 4.0 + vec2( 0.0, t * 0.25 ) ) * 0.6 + veilNoise_( a * 9.0 + w2 * 3.0 + vec2( 0.0, t * 0.6 ) ) * 0.4;
		float margin = 0.08 + ( 1.0 - o ) * 0.3;
		float f = veilSmin_( o * 1.1 - 0.12 - d, rim - margin, 0.18 ) + ( n - 0.5 ) * 0.36;
		float clear = smoothstep( 0.03, 0.2, f );
		float wisp = smoothstep( 0.3, 0.8, veilNoise_( a * 6.0 + w2 * 5.0 + vec2( 0.0, t * 0.5 ) ) );
		float puff = smoothstep( -0.14, 0.06, f ) * ( 1.0 - smoothstep( 0.12, 0.3, f ) ) * ( 0.3 + 0.7 * wisp ) * smoothstep( 0.0, 0.1, rim );
		vec2 sway = ( w2 - 0.5 ) * 0.08 * ( 1.0 - clear );
		vec4 under = media( uv + sway );
		vec3 haze = mix( vec3( 0.6, 0.64, 0.72 ), under.rgb * 1.2 + 0.1, 0.45 );
		vec3 seen = under.rgb * clear * ( 1.0 - puff * 0.7 ) + haze * puff * color.a;
		return vec4( seen, ( clear + puff * ( 1.0 - clear ) * 0.9 ) * under.a * color.a );
	}
	if ( style < 2.5 ) {
		// Liquid: a drop with three smaller ones that join it, and a
		// rim that bends what is under it.
		float r = o * 0.95;
		float t = clock * 1.3;
		float f = d - r;
		f = veilSmin_( f, length( q - vec2( cos( t ), sin( t * 1.3 ) ) * r * 0.75 ) - r * 0.42, 0.12 );
		f = veilSmin_( f, length( q - vec2( cos( t * 0.8 + 2.1 ), sin( t + 1.0 ) ) * r * 0.8 ) - r * 0.36, 0.12 );
		f = veilSmin_( f, length( q - vec2( cos( t * 1.1 + 4.0 ), sin( t * 0.7 + 3.0 ) ) * r * 0.7 ) - r * 0.3, 0.12 );
		float inside = 1.0 - smoothstep( -0.006, 0.006, f );
		float lens = exp( f / 0.06 ) * inside * ( 1.0 - o );
		vec2 bent = uv + dir * vec2( 1.0 / k, 1.0 ) * 0.07 * lens;
		vec4 under = media( bent );
		float shine = smoothstep( 0.5, 1.0, lens ) * smoothstep( -0.2, 0.6, dot( dir, vec2( -0.6, -0.8 ) ) );
		return vec4( ( under.rgb + vec3( shine * 0.35 ) ) * inside, under.a * inside );
	}
	if ( style < 3.5 ) {
		// Shatter: shards that fly in from around the pointer, grow to
		// their size and lock together; light in the cracks until they do.
		vec2 a = uv * vec2( k, 1.0 );
		vec4 v = veilShards_( a * 6.0 );
		vec2 seed = v.xy / 6.0;
		float h = veilHash_( floor( v.xy * 7.0 ) );
		vec2 sq = seed - c * vec2( k, 1.0 );
		float ds = length( sq );
		float sp = clamp( ( o * 1.7 - ds * 1.1 - h * 0.3 ) * 3.0, 0.0, 1.0 );
		float e = sp * sp * ( 3.0 - 2.0 * sp );
		vec2 away = ds > 0.0001 ? sq / ds : vec2( 0.0 );
		vec2 fly = ( away * 0.18 + vec2( h - 0.5, veilHash_( v.xy ) - 0.5 ) * 0.1 ) * ( 1.0 - e );
		float size = mix( 0.35, 1.0, e );
		vec2 at = seed + ( a - seed ) / size;
		vec4 v2 = veilShards_( at * 6.0 );
		float same = 1.0 - step( 0.001, length( v2.xy - v.xy ) );
		float crack = ( 1.0 - smoothstep( 0.0, 0.025, v.w ) ) * ( 1.0 - e );
		vec2 look = ( at - fly + away * crack * 0.012 ) / vec2( k, 1.0 );
		vec4 seen = e > 0.999 ? color : media( look );
		float shown = smoothstep( 0.0, 0.2, sp ) * same;
		return vec4( ( seen.rgb + vec3( crack * 0.45 ) * seen.a ) * shown, seen.a * shown );
	}
	if ( style < 4.5 ) {
		// Pixels: blocks, from the pointer outward, coarse and then fine.
		float n = 22.0;
		vec2 cells = vec2( n * k, n );
		vec2 cell = ( floor( uv * cells ) + 0.5 ) / cells;
		float at = length( ( cell - c ) * vec2( k, 1.0 ) );
		float t = o * 1.6 - at + ( veilHash_( floor( uv * cells ) ) - 0.5 ) * 0.25;
		float there = step( 0.0, t );
		vec2 big = ( floor( uv * cells * 0.5 ) + 0.5 ) / ( cells * 0.5 );
		vec4 block = t < 0.12 ? media( big ) : ( t < 0.3 ? media( cell ) : color );
		return block * there;
	}
	if ( style < 5.5 ) {
		// Blinds: slats that open from the pointer, one after the other.
		float n = 12.0;
		float s = uv.x + uv.y * 0.18;
		float i = floor( s * n );
		float from = abs( ( i + 0.5 ) / n - ( c.x + c.y * 0.18 ) ) * k;
		// Open past the full width, so that open slats join without a seam.
		float wide = o * 2.4 - from * 1.2;
		float w = clamp( wide, 0.0, 1.0 );
		float x = abs( fract( s * n ) - 0.5 ) * 2.0;
		float inside = 1.0 - smoothstep( wide - 0.04, wide, x );
		float shade = mix( 0.55, 1.0, w ) * ( 1.0 - 0.25 * x * ( 1.0 - w ) );
		return vec4( color.rgb * shade * inside, color.a * inside );
	}
	if ( style < 6.5 ) {
		// Lightning: the picture opens behind a front of bolts that strike
		// out ahead of it, lit blue where they have just been; now and then
		// an arc still crawls over it.
		float t = clock;
		vec2 a = uv * vec2( k, 1.0 );
		float jolt = floor( t * 12.0 );
		float n = veilNoise_( a * 4.0 ) * 0.6 + veilNoise_( a * 13.0 + jolt * 0.71 ) * 0.4;
		float f = o * 1.25 - 0.1 - d + ( n - 0.5 ) * 0.22;
		float inside = smoothstep( 0.0, 0.01, f );
		vec2 g = a * 3.0 + vec2( jolt * 1.37, jolt * 0.53 );
		float e = abs( veilNoise_( g + veilNoise_( g * 4.0 ) * 0.35 ) - 0.5 );
		float live = smoothstep( 0.0, 0.04, o );
		float reach = smoothstep( -0.3, 0.0, f ) * ( 1.0 - smoothstep( 0.0, 0.12, f ) ) * live;
		float idle = step( 0.82, veilHash_( vec2( jolt, 3.0 ) ) ) * 0.45 * inside;
		float core = 1.0 - smoothstep( 0.004, 0.012, e );
		float spark = min( ( core + exp( -e * 60.0 ) * 0.5 ) * ( reach * ( 0.6 + 0.4 * veilHash_( vec2( jolt, 1.0 ) ) ) + idle ), 1.0 );
		float lit = ( 1.0 - smoothstep( 0.0, 0.18, f ) ) * live;
		vec3 seen = mix( color.rgb, color.rgb * vec3( 0.75, 0.9, 1.45 ) + vec3( 0.05, 0.08, 0.16 ) * color.a, lit );
		vec3 bolt = mix( vec3( 0.35, 0.55, 1.0 ), vec3( 0.92, 0.96, 1.0 ), core );
		return vec4( seen * inside + bolt * spark * color.a, max( inside, spark ) * color.a );
	}
	if ( style < 7.5 ) {
		// Frost: the picture thaws out of ice from the pointer, its edge
		// grown with crystals that glint; the ice stays short of the edges.
		vec2 qn = ( uv - 0.5 ) / ( vec2( 0.5 ) - vec2( pad.x, pad.y ) );
		float rim = ( 1.0 - length( qn * vec2( 0.92, 1.0 ) ) ) * 0.4;
		float t = clock;
		vec2 a = uv * vec2( k, 1.0 );
		vec4 v = veilShards_( a * 24.0 );
		float h = veilHash_( floor( v.xy * 7.0 ) );
		float n = veilNoise_( a * 4.0 ) * 0.5 + veilNoise_( a * 11.0 ) * 0.3 + veilNoise_( a * 40.0 ) * 0.2;
		float margin = 0.07 + sin( t * 0.6 ) * 0.01 + ( 1.0 - o ) * 0.3;
		float f = veilSmin_( o * 1.1 - 0.12 - d, rim - margin, 0.12 ) + ( n - 0.5 ) * 0.14 + ( h - 0.5 ) * 0.04;
		float inside = smoothstep( 0.0, 0.006, f );
		// Ice in a band at the edge, feathered inward along the noise.
		float rime = ( 1.0 - smoothstep( 0.0, 0.07, f ) ) * 0.85 + ( 1.0 - smoothstep( 0.0, 0.16, f ) ) * smoothstep( 0.55, 0.8, veilNoise_( a * 30.0 + h ) ) * 0.4;
		vec2 tilt = ( vec2( veilHash_( v.xy + 1.3 ), veilHash_( v.xy + 4.1 ) ) - 0.5 ) * 0.02 * rime;
		vec4 under = media( uv + tilt );
		float facet = ( 1.0 - smoothstep( 0.0, 0.06, v.w ) ) * rime;
		float glint = step( 0.95, veilHash_( v.xy + floor( t * 2.0 + h * 5.0 ) ) ) * rime * ( 0.5 + 0.5 * sin( t * 6.0 + h * 30.0 ) );
		vec3 ice = vec3( 0.82, 0.92, 1.0 ) * under.a;
		float grey = dot( under.rgb, vec3( 0.3, 0.55, 0.15 ) );
		vec3 cold = mix( under.rgb, vec3( grey ) * vec3( 0.8, 0.92, 1.1 ), 0.6 );
		vec3 seen = mix( under.rgb, mix( cold, ice, 0.4 ), rime ) + ice * ( facet * 0.3 + glint );
		return vec4( seen * inside * color.a, under.a * inside * color.a );
	}
	if ( style < 8.5 ) {
		// Halftone: dots of print, a screen for each of red, green and blue,
		// that grow from the pointer with how much of each there is, until
		// they run together into the picture.
		vec2 a = uv * vec2( k, 1.0 );
		vec2 ca = c * vec2( k, 1.0 );
		vec3 cr = veilCell_( a, 0.26, 34.0 );
		vec3 cg = veilCell_( a, 1.31, 34.0 );
		vec3 cb = veilCell_( a, 0.79, 34.0 );
		float tr = o * 2.4 - length( cr.xy - ca );
		float tg = o * 2.4 - length( cg.xy - ca );
		float tb = o * 2.4 - length( cb.xy - ca );
		float ir = media( cr.xy / vec2( k, 1.0 ) ).r;
		float ig = media( cg.xy / vec2( k, 1.0 ) ).g;
		float ib = media( cb.xy / vec2( k, 1.0 ) ).b;
		float rr = clamp( tr, 0.0, 1.0 ) * mix( 0.2, 0.72, ir ) + smoothstep( 0.7, 1.2, tr ) * 0.8;
		float rg = clamp( tg, 0.0, 1.0 ) * mix( 0.2, 0.72, ig ) + smoothstep( 0.7, 1.2, tg ) * 0.8;
		float rb = clamp( tb, 0.0, 1.0 ) * mix( 0.2, 0.72, ib ) + smoothstep( 0.7, 1.2, tb ) * 0.8;
		float dr = 1.0 - smoothstep( rr - 0.06, rr, cr.z );
		float dg = 1.0 - smoothstep( rg - 0.06, rg, cg.z );
		float db = 1.0 - smoothstep( rb - 0.06, rb, cb.z );
		vec3 dots = vec3( dr * mix( ir, color.r, smoothstep( 0.8, 1.3, tr ) ), dg * mix( ig, color.g, smoothstep( 0.8, 1.3, tg ) ), db * mix( ib, color.b, smoothstep( 0.8, 1.3, tb ) ) );
		return vec4( dots * color.a, max( dr, max( dg, db ) ) * color.a );
	}
	if ( style < 9.5 ) {
		// Thermal: the picture comes up through a heat camera from the
		// pointer, shimmering, and cools into its colours; the pointer
		// stays warm.
		float t = clock;
		vec2 a = uv * vec2( k, 1.0 );
		float n = veilNoise_( a * 3.0 - vec2( 0.0, t * 0.4 ) ) * 0.6 + veilNoise_( a * 9.0 - vec2( 0.0, t * 0.9 ) ) * 0.4;
		float f = o * 1.3 - 0.1 - d + ( n - 0.5 ) * 0.25;
		float inside = smoothstep( 0.0, 0.015, f );
		float hot = 1.0 - smoothstep( 0.0, 0.35, f );
		float spot = exp( -d * d * 60.0 ) * 0.4 * smoothstep( 0.5, 1.0, o );
		float th = clamp( hot + spot, 0.0, 1.0 );
		vec2 shim = vec2( veilNoise_( a * 18.0 - vec2( 0.0, t * 3.0 ) ), veilNoise_( a * 18.0 + 7.0 - vec2( 0.0, t * 3.0 ) ) ) - 0.5;
		vec4 under = media( uv + shim * 0.012 * th );
		float lum = dot( under.rgb, vec3( 0.3, 0.55, 0.15 ) );
		vec3 cam = veilHeat_( clamp( lum * 0.85 + th * 0.3, 0.0, 1.0 ) ) * under.a;
		vec3 seen = mix( under.rgb, cam, smoothstep( 0.0, 0.9, th ) );
		return vec4( seen * inside * color.a, under.a * inside * color.a );
	}
	// Swirl: the picture turns out of a whirl at the pointer, along three
	// arms, darkened at its edge; a slight turn stays at the pointer.
	float t = clock;
	float c3 = 4.0 * dir.x * dir.x * dir.x - 3.0 * dir.x;
	float s3 = 3.0 * dir.y - 4.0 * dir.y * dir.y * dir.y;
	float ph = d * 18.0 - t * 3.0;
	float f = o * 1.3 - d + ( s3 * cos( ph ) + c3 * sin( ph ) ) * 0.05 * smoothstep( 0.0, 0.2, d );
	float inside = smoothstep( 0.0, 0.012, f );
	float spin = ( ( 1.0 - o ) * 7.0 + 0.18 + 0.1 * sin( t * 0.8 ) ) * exp( -d * 3.5 );
	float cs = cos( spin );
	float sn = sin( spin );
	vec2 rq = vec2( cs * q.x - sn * q.y, sn * q.x + cs * q.y ) * mix( 1.0, 0.55, ( 1.0 - o ) * exp( -d * 2.0 ) );
	vec4 under = media( c + rq / vec2( k, 1.0 ) );
	float horizon = exp( -max( f, 0.0 ) * 30.0 ) * inside * ( 1.0 - smoothstep( 0.9, 1.0, o ) );
	vec3 seen = under.rgb * ( 1.0 - horizon * 0.75 ) + vec3( 0.55, 0.35, 1.0 ) * under.a * horizon * 0.4;
	return vec4( seen * inside * color.a, under.a * inside * color.a );`,
} );

/** From one name's picture to the next, in the way chosen. */
export const turn = () => ( {
	head: HEAD,
	params: { style: STYLE, centre: VEIL.centre },
	transition: `
vec4 transition( vec2 uv ) {
	float k = resolution.x / resolution.y;
	vec2 c = vec2( centre.x, centre.y );
	vec2 q = ( uv - c ) * vec2( k, 1.0 );
	float d = length( q );
	vec2 dir = d > 0.0001 ? q / d : vec2( 0.0 );
	float p = progress;
	if ( style < 0.5 ) {
		// Burns into the next along a front of noise.
		float n = veilNoise_( uv * vec2( k, 1.0 ) * 4.0 ) * 0.65 + veilNoise_( uv * vec2( k, 1.0 ) * 11.0 ) * 0.35;
		float t = mix( -0.15, 1.15, p );
		float m = smoothstep( n - 0.03, n + 0.03, t );
		vec4 a = getFromColor( uv );
		vec4 b = getToColor( uv );
		float glow = ( 1.0 - smoothstep( 0.0, 0.03, abs( t - n ) ) ) * sin( p * PI ) * max( a.a, b.a );
		vec4 c4 = mix( a, b, m );
		vec3 fire = mix( vec3( 1.0, 0.25, 0.05 ), vec3( 1.0, 0.9, 0.6 ), glow * glow );
		return vec4( c4.rgb + fire * glow * 0.9, max( c4.a, glow ) );
	}
	if ( style < 1.5 ) {
		// A puff of smoke that swallows one picture and clears to the next.
		vec2 a = uv * vec2( k, 1.0 );
		float s = sin( p * PI );
		vec2 w = vec2( veilNoise_( a * 3.0 + vec2( 0.0, p * 1.5 ) ), veilNoise_( a * 3.0 + vec2( 5.2, 1.3 - p ) ) );
		float n = veilNoise_( a * 3.5 + w * 4.0 + vec2( 0.0, p * 2.0 ) ) * 0.6 + veilNoise_( a * 9.0 + w * 3.0 ) * 0.4;
		float puff = clamp( s * 1.7 - d * 0.6 + ( n - 0.5 ) * 0.9, 0.0, 1.0 );
		float m = smoothstep( 0.4, 0.6, p + ( n - 0.5 ) * 0.25 );
		vec2 sway = ( w - 0.5 ) * 0.06 * puff;
		vec4 c4 = mix( getFromColor( uv + sway ), getToColor( uv + sway ), m );
		vec3 haze = mix( vec3( 0.6, 0.64, 0.72 ), c4.rgb + 0.12, 0.45 ) * c4.a;
		return vec4( mix( c4.rgb, haze, puff * 0.92 ), c4.a );
	}
	if ( style < 2.5 ) {
		// A drop that lands: rings that run out and settle.
		float r = p * 1.0;
		float ring = exp( -abs( d - r ) * 14.0 ) * ( 1.0 - p );
		vec2 off = dir * vec2( 1.0 / k, 1.0 ) * sin( ( d - r ) * 70.0 ) * 0.012 * ring;
		float m = smoothstep( r + 0.01, r - 0.01, d );
		return mix( getFromColor( uv + off * 1.5 ), getToColor( uv + off ), m );
	}
	if ( style < 3.5 ) {
		// Shatters out, and the next picture's shards fly in.
		vec2 a = uv * vec2( k, 1.0 );
		vec4 v = veilShards_( a * 6.0 );
		vec2 seed = v.xy / 6.0;
		float h = veilHash_( floor( v.xy * 7.0 ) );
		vec2 sq = seed - c * vec2( k, 1.0 );
		float ds = length( sq );
		float sp = clamp( ( p * 1.8 - ds * 0.9 - h * 0.3 ) * 2.5, 0.0, 1.0 );
		if ( sp <= 0.0 ) {
			return getFromColor( uv );
		}
		if ( sp >= 1.0 ) {
			return getToColor( uv );
		}
		vec2 away = ds > 0.0001 ? sq / ds : vec2( 0.0 );
		float go = min( sp * 2.0, 1.0 );
		float come = max( sp * 2.0 - 1.0, 0.0 );
		float size = sp < 0.5 ? mix( 1.0, 0.3, go ) : mix( 0.3, 1.0, come );
		vec2 push = away * 0.14 * ( sp < 0.5 ? go : 1.0 - come );
		vec2 at = seed + ( a - seed ) / size;
		vec4 v2 = veilShards_( at * 6.0 );
		float same = 1.0 - step( 0.001, length( v2.xy - v.xy ) );
		vec2 look = ( at - push ) / vec2( k, 1.0 );
		vec4 seen = sp < 0.5 ? getFromColor( look ) : getToColor( look );
		float crack = ( 1.0 - smoothstep( 0.0, 0.025, v.w ) ) * sin( sp * PI );
		return vec4( ( seen.rgb + vec3( crack * 0.45 ) * seen.a ) * same, seen.a * same );
	}
	if ( style < 4.5 ) {
		// Blocks that coarsen, change, and come back.
		float n = mix( 120.0, 10.0, sin( p * PI ) );
		vec2 cells = vec2( n * k, n );
		vec2 cell = ( floor( uv * cells ) + 0.5 ) / cells;
		vec2 at = p < 0.02 || p > 0.98 ? uv : cell;
		float m = step( veilHash_( floor( uv * cells ) + 7.0 ) * 0.6 + 0.2, p );
		return mix( getFromColor( at ), getToColor( at ), m );
	}
	if ( style < 5.5 ) {
		// Slats that turn, one after the other: the next on their backs.
		float n = 12.0;
		float s = uv.x + uv.y * 0.18;
		float i = floor( s * n );
		float from = abs( ( i + 0.5 ) / n - ( c.x + c.y * 0.18 ) ) * k;
		float a = clamp( p * 1.8 - from * 0.8, 0.0, 1.0 ) * PI;
		float w = abs( cos( a ) );
		float x = ( fract( s * n ) - 0.5 ) * 2.0;
		float inside = 1.0 - smoothstep( w, w + 0.03, abs( x ) );
		vec4 seen = a < PI * 0.5 ? getFromColor( uv ) : getToColor( uv );
		float shade = 0.45 + 0.55 * w;
		return vec4( seen.rgb * shade * inside, seen.a * inside );
	}
	if ( style < 6.5 ) {
		// Strikes into the next: bolts run out ahead of it, with a flash.
		vec2 a = uv * vec2( k, 1.0 );
		float jolt = floor( p * 30.0 );
		float n = veilNoise_( a * 4.0 ) * 0.6 + veilNoise_( a * 13.0 + jolt * 0.71 ) * 0.4;
		float f = p * 1.4 - 0.15 - d + ( n - 0.5 ) * 0.22;
		float m = smoothstep( 0.0, 0.01, f );
		vec2 g = a * 3.0 + vec2( jolt * 1.37, jolt * 0.53 );
		float e = abs( veilNoise_( g + veilNoise_( g * 4.0 ) * 0.35 ) - 0.5 );
		float s = sin( p * PI );
		float reach = smoothstep( -0.3, 0.0, f ) * ( 1.0 - smoothstep( 0.0, 0.12, f ) ) * s;
		float core = 1.0 - smoothstep( 0.004, 0.012, e );
		float spark = min( ( core + exp( -e * 60.0 ) * 0.5 ) * reach, 1.0 );
		vec4 c4 = mix( getFromColor( uv ), getToColor( uv ), m );
		float s3 = s * s * s;
		float flash = s3 * s3 * 0.3 * step( 0.5, veilHash_( vec2( jolt, 2.0 ) ) );
		vec3 bolt = mix( vec3( 0.35, 0.55, 1.0 ), vec3( 0.92, 0.96, 1.0 ), core );
		return vec4( c4.rgb * ( 1.0 + flash ) + bolt * spark * c4.a, c4.a );
	}
	if ( style < 7.5 ) {
		// Ices over from the pointer, and thaws to the next.
		vec2 a = uv * vec2( k, 1.0 );
		vec4 v = veilShards_( a * 14.0 );
		float h = veilHash_( floor( v.xy * 7.0 ) );
		float rime = clamp( sin( p * PI ) * 1.6 - d * 0.7 + ( h - 0.5 ) * 0.4, 0.0, 1.0 );
		float m = smoothstep( 0.45, 0.55, p + ( h - 0.5 ) * 0.15 );
		vec2 tilt = ( vec2( veilHash_( v.xy + 1.3 ), veilHash_( v.xy + 4.1 ) ) - 0.5 ) * 0.025 * rime;
		vec4 c4 = mix( getFromColor( uv + tilt ), getToColor( uv + tilt ), m );
		float grey = dot( c4.rgb, vec3( 0.3, 0.55, 0.15 ) );
		vec3 ice = vec3( 0.82, 0.92, 1.0 ) * c4.a;
		vec3 seen = mix( c4.rgb, mix( vec3( grey ) * vec3( 0.8, 0.92, 1.1 ), ice, 0.55 ), rime );
		return vec4( seen + ice * ( 1.0 - smoothstep( 0.0, 0.05, v.w ) ) * rime * 0.35, c4.a );
	}
	if ( style < 8.5 ) {
		// Breaks into dots of print, and the dots turn into the next.
		vec2 a = uv * vec2( k, 1.0 );
		float s = sin( p * PI );
		vec3 cell = veilCell_( a, 0.79, 34.0 );
		vec2 at = cell.xy / vec2( k, 1.0 );
		float m = smoothstep( -0.05, 0.05, p * 1.4 - 0.2 - length( cell.xy - c * vec2( k, 1.0 ) ) * 0.5 );
		vec4 dot4 = mix( getFromColor( at ), getToColor( at ), m );
		float lum = dot( dot4.rgb, vec3( 0.3, 0.55, 0.15 ) );
		float r = mix( 0.9, mix( 0.18, 0.72, lum ), smoothstep( 0.0, 0.6, s ) );
		float cover = 1.0 - smoothstep( r - 0.06, r, cell.z );
		vec4 whole = mix( getFromColor( uv ), getToColor( uv ), m );
		return mix( whole, dot4 * cover, smoothstep( 0.05, 0.4, s ) );
	}
	if ( style < 9.5 ) {
		// Heats up into the camera's colours, and cools into the next.
		vec2 a = uv * vec2( k, 1.0 );
		float s = sin( p * PI );
		float n = veilNoise_( a * 3.0 - vec2( 0.0, p * 2.0 ) ) * 0.6 + veilNoise_( a * 9.0 - vec2( 0.0, p * 4.0 ) ) * 0.4;
		float m = smoothstep( -0.05, 0.05, p * 1.4 - 0.2 - d * 0.5 + ( n - 0.5 ) * 0.15 );
		vec2 shim = vec2( veilNoise_( a * 18.0 - vec2( 0.0, p * 12.0 ) ), veilNoise_( a * 18.0 + 7.0 - vec2( 0.0, p * 12.0 ) ) ) - 0.5;
		vec4 c4 = mix( getFromColor( uv + shim * 0.012 * s ), getToColor( uv + shim * 0.012 * s ), m );
		float lum = dot( c4.rgb, vec3( 0.3, 0.55, 0.15 ) );
		vec3 cam = veilHeat_( clamp( lum * 0.85 + s * 0.3, 0.0, 1.0 ) ) * c4.a;
		return vec4( mix( c4.rgb, cam, clamp( s * 1.3 - d * 0.3, 0.0, 1.0 ) ), c4.a );
	}
	// Whirls into the pointer, and the next whirls out of it.
	float m = smoothstep( -0.05, 0.05, p * 1.3 - 0.15 - d * 0.6 );
	float spin = sin( p * PI ) * 8.0 * exp( -d * 2.5 ) * ( m > 0.5 ? -1.0 : 1.0 );
	float cs = cos( spin );
	float sn = sin( spin );
	vec2 rq = vec2( cs * q.x - sn * q.y, sn * q.x + cs * q.y ) * mix( 1.0, 0.6, sin( p * PI ) * exp( -d * 2.0 ) );
	vec2 at = c + rq / vec2( k, 1.0 );
	vec4 seen = m > 0.5 ? getToColor( at ) : getFromColor( at );
	float horizon = exp( -abs( p * 1.3 - 0.15 - d * 0.6 ) * 25.0 ) * sin( p * PI );
	return vec4( seen.rgb * ( 1.0 - horizon * 0.7 ), seen.a );
}`,
} );

/** The ways, by name, in the order of `STYLE`. */
export const WAYS = [ 'Burn', 'Smoke', 'Liquid', 'Shatter', 'Pixels', 'Blinds', 'Lightning', 'Frost', 'Halftone', 'Thermal', 'Swirl' ] as const;
