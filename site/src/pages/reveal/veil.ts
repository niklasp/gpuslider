/**
 * The two effects of the index: `veil()`, which lets the picture grow out
 * of the pointer through a ragged mask with a burning edge and drags it
 * behind the pointer, and `dissolve()`, which burns one picture into the
 * next as another name is pointed at.
 *
 * Their own noise, by names of their own: the effects of the library have
 * theirs, and a page can have both.
 */
const NOISE = `
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
float veilFbm_( vec2 p ) {
	float v = 0.0;
	float a = 0.5;
	for ( int i = 0; i < 4; i++ ) {
		v += a * veilNoise_( p );
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}`;

/**
 * What the page writes into on every frame, and the effect reads: how far
 * the picture is open (0 to 1), where in it the pointer is (in its uv),
 * how far it lags behind the pointer (px, right and down), and a clock
 * that runs while it is open, for the edge that crawls.
 */
export const VEIL = {
	open: [ 0 ],
	centre: [ 0.5, 0.5 ],
	drift: [ 0, 0 ],
	clock: [ 0 ],
};

/** The picture grows out of the pointer, and trails it. */
export const veil = () => ( {
	head: NOISE,
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
	// A ragged hole around the pointer that opens until it is all of the
	// picture; at its edge a thin line of fire, which is gone once it is
	// open.
	color: `
	vec2 q = ( uv - vec2( centre.x, centre.y ) ) * vec2( uSize.x / uSize.y, 1.0 );
	vec2 a = uv * vec2( uSize.x / uSize.y, 1.0 );
	float n = veilFbm_( a * 4.0 + vec2( clock * 0.25, -clock * 0.15 ) ) * 0.7 + veilNoise_( a * 14.0 ) * 0.3;
	float r = open * 1.45 - 0.18;
	float f = r - length( q ) + ( n - 0.5 ) * 0.5;
	float inside = smoothstep( 0.0, 0.012, f );
	float edge = ( 1.0 - smoothstep( 0.0, 0.03, abs( f ) ) ) * smoothstep( 0.0, 0.04, open ) * ( 1.0 - smoothstep( 0.75, 1.0, open ) ) * color.a;
	vec3 fire = mix( vec3( 1.0, 0.2, 0.03 ), vec3( 1.0, 0.9, 0.6 ), edge * edge );
	return vec4( color.rgb * inside + fire * edge * 1.3, max( color.a * inside, edge ) );`,
} );

/** One picture burns into the next along a front of noise. */
export const dissolve = () => ( {
	head: NOISE,
	transition: `
vec4 transition( vec2 uv ) {
	float n = veilFbm_( uv * vec2( resolution.x / resolution.y, 1.0 ) * 3.0 );
	float t = mix( -0.15, 1.15, progress );
	float m = smoothstep( n - 0.035, n + 0.035, t );
	vec4 a = getFromColor( uv );
	vec4 b = getToColor( uv );
	float glow = ( 1.0 - smoothstep( 0.0, 0.03, abs( t - n ) ) ) * sin( progress * PI ) * max( a.a, b.a );
	vec4 c = mix( a, b, m );
	vec3 fire = mix( vec3( 1.0, 0.25, 0.05 ), vec3( 1.0, 0.9, 0.6 ), glow * glow );
	return vec4( c.rgb + fire * glow * 0.9, max( c.a, glow ) );
}`,
} );
