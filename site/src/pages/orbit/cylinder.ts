/**
 * Puts the slides of a row on a cylinder that stands in the middle of the
 * view: the way along the row is the way around, one turn a loop of the row
 * (`period`, which the page measures). The cylinder is seen a little from
 * above (`tilt`), may lean to a side (`roll`), and stands back from the
 * screen (`push`, in radii). What is behind is darker, as in a fog; what
 * is seen from inside is turned, so that it reads the right way round.
 *
 * `inner` moves the eye into the cylinder, in front of its axis: the near
 * wall comes towards the eye, fades, and is behind it; what is left is the
 * far wall, curving round the eye. `flat` unrolls the cylinder into the row
 * it is. With `mirror` the row is drawn upside down below a floor: a
 * reflection, which fades away from it.
 *
 * The page writes into `period`, `shape` and `more` while it is scrolled:
 * every slider that is given the same arrays is the same cylinder. `eye` is
 * the perspective of the canvas, px.
 */

/** What `place` is told of a slide, see `hit()`. */
type About = { view: number[]; quad: number[]; velocity: number };

export type Shape = {
	/** How large, against a cylinder whose way around is the row. */
	k: number;
	/** Seen from above, radians. */
	tilt: number;
	/** Leaning to a side, radians. */
	roll: number;
	/** The middle of the cylinder below the middle of the view, in heights of the view. */
	y: number;
	/** How far it stands back, in radii. */
	push: number;
	/** 0 seen from outside, 1 from inside. */
	inner: number;
	/** 0 a cylinder, 1 the row unrolled. */
	flat: number;
	/** The floor, below the slides, in heights of the view. */
	floor: number;
};

// Inside, the eye is this far in front of the axis, in radii: nearer the
// near wall than the far one, so that the far wall curves round it.
const INSIDE = 0.75;
// A slide whose middle comes this near to the eye fades: from the second
// to the first, in radii or in eyes, whichever is less; and nearer it is
// not drawn at all.
const FADE = [ 0.5, 0.9 ];

const HEAD = `
float orbitTurn( float x, float P ) {
	return ( x - P * floor( x / P ) ) / P * 2.0 * PI;
}
float orbitR( float P, vec4 shape ) {
	return shape.x * P / ( 2.0 * PI );
}
float orbitBack( float R, vec4 more, float eye ) {
	return mix( more.x * R, ${ INSIDE.toFixed( 2 ) } * R - eye, more.y );
}
float orbitNear( float x, float P, vec4 shape, vec4 more, float eye ) {
	float R = orbitR( P, shape );
	float z = R * cos( orbitTurn( x, P ) ) - orbitBack( R, more, eye );
	float s = min( R, eye );
	// Unrolled, what was behind the eye comes back last, into its place.
	return mix( smoothstep( ${ FADE[ 0 ] } * s, ${ FADE[ 1 ] } * s, eye - z ), 1.0, smoothstep( 0.8, 1.0, more.z ) );
}
float orbitOutside( float a, float P, vec4 shape, vec4 more, float eye ) {
	float R = orbitR( P, shape );
	return mix( cos( a ) * ( eye + orbitBack( R, more, eye ) ) - R, 1.0, more.z );
}
vec3 orbitAt( float cx, float px, float py, float hh, float P, vec4 shape, vec4 more, float mirror, float lean, float vel, float eye ) {
	float f = more.z;
	float k = shape.x;
	float R = orbitR( P, shape );
	float a = orbitTurn( cx + px, P );
	float X = mix( R * sin( a ), cx - uView.x * 0.5 + px, f );
	float Z = mix( R * cos( a ) - orbitBack( R, more, eye ), 0.0, f );
	float s = mix( k, 1.0, f );
	float Y = py * s;
	X = X + lean * clamp( vel, -2.0, 2.0 ) * Y;
	float ground = s * hh * 0.5 + more.w * uView.y;
	if ( mirror > 0.5 ) {
		Y = 2.0 * ground - Y;
	}
	float t = shape.y * ( 1.0 - f );
	float r = shape.z * ( 1.0 - f );
	float Y2 = Y * cos( t ) + Z * sin( t );
	float Z2 = Z * cos( t ) - Y * sin( t );
	float X3 = X * cos( r ) - Y2 * sin( r );
	float Y3 = X * sin( r ) + Y2 * cos( r ) + shape.w * uView.y;
	// A slide that has come by the eye is behind it: not drawn at all, so
	// that it hides nothing.
	if ( orbitNear( cx, P, shape, more, eye ) < 0.01 ) {
		Z2 = 3.0 * eye;
	}
	return vec3( X3, Y3, Z2 );
}
`;

const smooth = ( a: number, b: number, x: number ) => {
	const u = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return u * u * ( 3 - 2 * u );
};

/** The same in JS, for `place`: a click finds the slide that is seen. */
const at = (
	cx: number,
	px: number,
	py: number,
	hh: number,
	P: number,
	view: number[],
	shape: number[],
	more: number[],
	mirror: number,
	lean: number,
	vel: number,
	eye: number
) => {
	const f = more[ 2 ];
	const k = shape[ 0 ];
	const R = ( k * P ) / ( 2 * Math.PI );
	const back = more[ 0 ] * R + ( INSIDE * R - eye - more[ 0 ] * R ) * more[ 1 ];
	const turn = ( x: number ) => ( ( ( ( x % P ) + P ) % P ) / P ) * 2 * Math.PI;
	const a = turn( cx + px );
	const least = Math.min( R, eye );
	const z = R * Math.cos( turn( cx ) ) - back;
	const near = smooth( FADE[ 0 ] * least, FADE[ 1 ] * least, eye - z );
	if ( near + ( 1 - near ) * smooth( 0.8, 1, f ) < 0.01 ) {
		// Behind the eye: nowhere a click can find it.
		return [ 1e6, 1e6, 0 ];
	}
	let X = R * Math.sin( a ) * ( 1 - f ) + ( cx - view[ 0 ] / 2 + px ) * f;
	const Z = ( R * Math.cos( a ) - back ) * ( 1 - f );
	const s = k * ( 1 - f ) + f;
	let Y = py * s;
	X += lean * Math.max( -2, Math.min( 2, vel ) ) * Y;
	const ground = ( s * hh ) / 2 + more[ 3 ] * view[ 1 ];
	if ( mirror > 0.5 ) {
		Y = 2 * ground - Y;
	}
	const t = shape[ 1 ] * ( 1 - f );
	const r = shape[ 2 ] * ( 1 - f );
	const Y2 = Y * Math.cos( t ) + Z * Math.sin( t );
	const Z2 = Z * Math.cos( t ) - Y * Math.sin( t );
	const X3 = X * Math.cos( r ) - Y2 * Math.sin( r );
	const Y3 = X * Math.sin( r ) + Y2 * Math.cos( r ) + shape[ 3 ] * view[ 1 ];
	return [ X3, Y3, Z2 ];
};

/**
 * @param options          Options.
 * @param options.period   The length of a loop of the row, px.
 * @param options.shape    k, tilt, roll, y: see `Shape`.
 * @param options.more     push, inner, flat, floor: see `Shape`.
 * @param options.eye      The perspective of the canvas, px.
 * @param options.mirror   1: drawn as the reflection below the floor.
 * @param options.lean     How far the slides lean with the speed.
 */
export const cylinder = ( {
	period,
	shape,
	more,
	eye,
	mirror = 0,
	lean = 0.12,
}: {
	period: number[];
	shape: number[];
	more: number[];
	eye: number;
	mirror?: number;
	lean?: number;
} ) => ( {
	params: { period, shape, more, eye, mirror, lean },
	head: HEAD,
	vertex: `
	vec2 c = uQuad.xy + uQuad.zw * 0.5;
	vec3 w = orbitAt( c.x, p.x, p.y, uQuad.w, period, shape, more, mirror, lean, uVelocity, eye );
	return vec3( w.x - ( c.x - uView.x * 0.5 ), w.y - ( c.y - uView.y * 0.5 ), w.z );`,
	// What is seen from inside is seen from behind: turned back, it reads.
	uv: `
	float a = orbitTurn( uQuad.x + uv.x * uQuad.z, period );
	if ( orbitOutside( a, period, shape, more, eye ) < 0.0 ) {
		uv = vec2( 1.0 - uv.x, uv.y );
	}
	return uv;`,
	color: `
	float a = orbitTurn( uQuad.x + uv.x * uQuad.z, period );
	float n = mix( cos( a ) * cos( shape.y ), 1.0, more.z );
	// Behind is darker; from inside, the middle of the far wall is lit.
	float lit = mix( 0.2, 1.0, smoothstep( -0.95, 0.9, n ) );
	lit = mix( lit, 0.55 + 0.45 * smoothstep( 0.3, -0.9, n ), more.y );
	// What comes near the eye fades, as a whole slide.
	float near = orbitNear( uQuad.x + uQuad.z * 0.5, period, shape, more, eye );
	vec4 c = vec4( color.rgb * lit, color.a ) * near;
	if ( mirror > 0.5 ) {
		c = c * 0.34 * pow( uv.y, 2.5 );
	}
	return c;`,
	place( p: number[], { view, quad, velocity }: About ) {
		const cx = quad[ 0 ] + quad[ 2 ] / 2;
		const cy = quad[ 1 ] + quad[ 3 ] / 2;
		const w = at( cx, p[ 0 ], p[ 1 ], quad[ 3 ], period[ 0 ], view, shape, more, mirror, lean, velocity, eye );
		p[ 0 ] = w[ 0 ] - ( cx - view[ 0 ] / 2 );
		p[ 1 ] = w[ 1 ] - ( cy - view[ 1 ] / 2 );
		p[ 2 ] = w[ 2 ];
	},
} );

/** Writes a shape into the arrays the effects read. */
export const write = ( s: Shape, shape: number[], more: number[] ) => {
	shape[ 0 ] = s.k;
	shape[ 1 ] = s.tilt;
	shape[ 2 ] = s.roll;
	shape[ 3 ] = s.y;
	more[ 0 ] = s.push;
	more[ 1 ] = s.inner;
	more[ 2 ] = s.flat;
	more[ 3 ] = s.floor;
};
