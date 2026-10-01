/**
 * The folds of the grid: effects of the canvas that turn each picture in
 * 3D by where its row is on the screen and how fast the page is scrolled.
 *
 * Every row is told two things by the page, in arrays it writes into on
 * every frame (see Fold.tsx): `at`, where the middle of the row is, from
 * -1 at the top of the screen through 0 in its middle to 1 at the bottom;
 * and `speed`, how fast the page is scrolled, from -1 to 1. A row in the
 * middle of a page at rest lies flat; one that comes in at an edge is
 * folded, and the columns come in one after the other: the stagger. The
 * speed of the page ripples through all of it.
 *
 * Each fold says in JS too where it puts a point (`place`), so that a
 * click finds the picture where it is drawn.
 */

/** What `place` is told of a slide. */
type About = { view: number[]; quad: number[] };

/** What the page writes into: one `at` for each row, one `speed` for all. */
export type Told = { at: number[]; speed: number[] };

const smoothstep = ( a: number, b: number, x: number ) => {
	const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );
};

/**
 * How far a picture is folded, from -1 to 1: by the row's place on the
 * screen, later for the columns further right, and by the speed.
 */
const HEAD = `
	float foldOf( float y, float v, float cx, float stagger ) {
		float yy = y + ( cx - 0.5 ) * stagger * sign( y );
		float edge = smoothstep( 0.3, 1.05, abs( yy ) ) * sign( yy );
		return clamp( edge + v * ( 0.7 + 0.3 * sin( cx * 9.0 ) ), -1.0, 1.0 );
	}
	float across( ) {
		return ( uQuad.x + uQuad.z * 0.5 ) / uView.x;
	}`;

const foldOf = ( y: number, v: number, cx: number, stagger: number ) => {
	const yy = y + ( cx - 0.5 ) * stagger * Math.sign( y );
	const edge = smoothstep( 0.3, 1.05, Math.abs( yy ) ) * Math.sign( yy );
	return Math.min( 1, Math.max( -1, edge + v * ( 0.7 + 0.3 * Math.sin( cx * 9 ) ) ) );
};

const acrossOf = ( { view, quad }: About ) => ( quad[ 0 ] + quad[ 2 ] / 2 ) / view[ 0 ];

/**
 * Rise: cards that lie back on a table and stand up as they come in.
 * Below the middle a card is hinged at its lower edge, above it at its
 * upper one; what is folded leans away.
 */
export const rise = ( { at, speed }: Told, { amount = 1.3, stagger = 0.6 } = {} ) => {
	const move = ( x: number, y: number, z: number, k: number, h: number ) => {
		const a = k * amount;
		const hinge = a > 0 ? h : -h;
		const d = y - hinge;
		return [ x, hinge + d * Math.cos( a ), z - Math.abs( d ) * Math.sin( Math.abs( a ) ) ];
	};
	return {
		head: HEAD,
		params: { row: at, pace: speed, amount, stagger },
		vertex: `
	float a = foldOf( row, pace, across(), stagger ) * amount;
	float h = uQuad.w * 0.5;
	float hinge = a > 0.0 ? h : -h;
	float d = p.y - hinge;
	return vec3( p.x, hinge + d * cos( a ), p.z - abs( d ) * sin( abs( a ) ) );`,
		color: `
	float a = abs( foldOf( row, pace, across(), stagger ) );
	return vec4( color.rgb * ( 1.0 - 0.45 * a ), color.a );`,
		place( p: number[], about: About ) {
			const k = foldOf( at[ 0 ], speed[ 0 ], acrossOf( about ), stagger );
			[ p[ 0 ], p[ 1 ], p[ 2 ] ] = move( p[ 0 ], p[ 1 ], p[ 2 ], k, about.quad[ 3 ] / 2 );
		},
	};
};

/**
 * Accordion: the row is a sheet folded in pleats, each picture turned on
 * its upright axis, one way and the other along the row.
 */
export const accordion = ( { at, speed }: Told, { amount = 1.1, pleats = 4, stagger = 0.4 } = {} ) => ( {
	head: HEAD,
	params: { row: at, pace: speed, amount, pleats, stagger },
	vertex: `
	float cx = across();
	float a = foldOf( row, pace, cx, stagger ) * amount * cos( cx * PI * pleats );
	return vec3( p.x * cos( a ), p.y, p.z + p.x * sin( a ) );`,
	color: `
	float cx = across();
	float a = foldOf( row, pace, cx, stagger ) * cos( cx * PI * pleats );
	return vec4( color.rgb * ( 1.0 - 0.18 * abs( a ) + 0.12 * a * ( uv.x - 0.5 ) * 2.0 ), color.a );`,
	place( p: number[], about: About ) {
		const cx = acrossOf( about );
		const a = foldOf( at[ 0 ], speed[ 0 ], cx, stagger ) * amount * Math.cos( cx * Math.PI * pleats );
		const x = p[ 0 ];
		p[ 0 ] = x * Math.cos( a );
		p[ 2 ] += x * Math.sin( a );
	},
} );

/**
 * Swell: a wave runs through the columns, each picture tipped forwards or
 * back on its level axis and lifted, as if the grid lay on water.
 */
export const swell = ( { at, speed }: Told, { amount = 0.9, lift = 90, stagger = 0.8 } = {} ) => {
	const wave = ( cx: number, y: number ) => Math.sin( cx * Math.PI * 3 - y * 3 );
	return {
		head: HEAD,
		params: { row: at, pace: speed, amount, lift, stagger },
		vertex: `
	float cx = across();
	float k = foldOf( row, pace, cx, stagger );
	float w = sin( cx * PI * 3.0 - row * 3.0 );
	float a = abs( k ) * amount * w;
	return vec3( p.x, p.y * cos( a ), p.z + p.y * sin( a ) + abs( k ) * lift * w );`,
		color: `
	float cx = across();
	float k = foldOf( row, pace, cx, stagger );
	float w = sin( cx * PI * 3.0 - row * 3.0 );
	return vec4( color.rgb * ( 1.0 + 0.16 * abs( k ) * w ), color.a );`,
		place( p: number[], about: About ) {
			const cx = acrossOf( about );
			const k = foldOf( at[ 0 ], speed[ 0 ], cx, stagger );
			const w = wave( cx, at[ 0 ] );
			const a = Math.abs( k ) * amount * w;
			const y = p[ 1 ];
			p[ 1 ] = y * Math.cos( a );
			p[ 2 ] += y * Math.sin( a ) + Math.abs( k ) * lift * w;
		},
	};
};

/**
 * Tunnel: the row bends round the one who looks, its ends coming closer,
 * and the rows above and below lean in: a tunnel, the deeper the faster.
 * In the middle of a page at rest it is flat. It bends at most so far
 * that the ends of the screen are turned by a radian: further, and they
 * would turn their backs.
 */
export const tunnel = ( { at, speed }: Told, { amount = 1, stagger = 0 } = {} ) => {
	const move = ( p: number[], about: About ) => {
		const { view, quad } = about;
		const k = Math.abs( foldOf( at[ 0 ], speed[ 0 ], acrossOf( about ), stagger ) );
		const c = Math.min( 1, amount * k ) + 0.0001;
		const gx = quad[ 0 ] + quad[ 2 ] / 2 + p[ 0 ] - view[ 0 ] / 2;
		const r = view[ 0 ] / ( c * 2.0 );
		const th = gx / r;
		const t = -at[ 0 ] * 0.55 * c;
		const y = p[ 1 ];
		p[ 0 ] += r * Math.sin( th ) - gx;
		p[ 1 ] = y * Math.cos( t );
		p[ 2 ] += r * ( 1 - Math.cos( th ) ) * 0.8 + y * Math.sin( t ) - c * 60;
	};
	return {
		head: HEAD,
		params: { row: at, pace: speed, amount, stagger },
		vertex: `
	float k = abs( foldOf( row, pace, across(), stagger ) );
	float c = min( amount * k, 1.0 ) + 0.0001;
	float gx = uQuad.x + uQuad.z * 0.5 + p.x - uView.x * 0.5;
	float r = uView.x / ( c * 2.0 );
	float th = gx / r;
	float t = -row * 0.55 * c;
	return vec3(
		p.x + r * sin( th ) - gx,
		p.y * cos( t ),
		p.z + r * ( 1.0 - cos( th ) ) * 0.8 + p.y * sin( t ) - c * 60.0 );`,
		color: `
	float k = abs( foldOf( row, pace, across(), stagger ) );
	float gx = abs( uQuad.x + uQuad.z * uv.x - uView.x * 0.5 ) / uView.x;
	return vec4( color.rgb * ( 1.0 - 0.5 * k * gx ), color.a );`,
		place: move,
	};
};
