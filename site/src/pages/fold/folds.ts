/**
 * The folds of the walls: effects of the canvas that fold every picture of
 * a wall on its own, one after another, as the wall comes into the screen,
 * and fold them away again as it leaves. A wall in the middle of the
 * screen is flat. Where it is decides it all, so the page can be scrolled
 * either way, at any speed, and stopped anywhere: what is seen is the
 * same.
 *
 * The page tells them, in an array it writes into (see Fold.tsx):
 * - `top`: where the top of the wall is on the screen, px, and how high
 *   the screen is: `[ top, height ]`.
 *
 * A wall is one slider whose slides the page lays out in a grid: `uQuad`
 * is a picture, `uView` the wall. In which order the pictures come is the
 * stagger: by column, along a diagonal, from the middle out, or as rain.
 * Each fold says in JS too where it puts a point (`place`), so that a
 * click finds the picture that is seen there.
 */
import type { Effect } from 'gpuslider/effects';

/** What `place` is told of a picture. */
type About = { view: number[]; quad: number[] };

/** What the page writes into. */
export type Told = { top: number[] };

const clamp = ( x: number ) => Math.min( 1, Math.max( 0, x ) );

/**
 * How folded a picture is, 0 to 1, given its turn `s` (0 first, 1 last),
 * and whether its wall is below the middle of the screen (1) or above
 * (-1). The wall comes in and the pictures unfold in turn, the lower rows
 * a little later; it goes and they fold, in turn again.
 */
const AMOUNT = `
	float foldSide( vec2 top ) {
		return top.x + uView.y * 0.5 > top.y * 0.5 ? 1.0 : -1.0;
	}
	float foldOf( vec2 top, float s ) {
		float d = ( top.x + uView.y * 0.5 - top.y * 0.5 ) / top.y;
		float h = uView.y / top.y;
		float e0 = 0.5 + h * 0.5 - 0.1;
		float e1 = max( 0.04, 0.5 - h * 0.5 + 0.12 );
		float p = clamp( ( e0 - abs( d ) ) / max( e0 - e1, 0.05 ), 0.0, 1.0 );
		float ny = ( uQuad.y + uQuad.w * 0.5 ) / uView.y;
		float lead = d > 0.0 ? ny : 1.0 - ny;
		float t = clamp( s, 0.0, 1.0 ) * 0.8 + clamp( lead, 0.0, 1.0 ) * 0.2;
		float u = clamp( ( p - t * 0.7 ) / 0.3, 0.0, 1.0 );
		return 1.0 - u * u * ( 3.0 - 2.0 * u );
	}`;

const sideOf = ( top: number[], view: number[] ) =>
	top[ 0 ] + view[ 1 ] / 2 > top[ 1 ] / 2 ? 1 : -1;

const foldOf = ( top: number[], { view, quad }: About, s: number ) => {
	const d = ( top[ 0 ] + view[ 1 ] / 2 - top[ 1 ] / 2 ) / top[ 1 ];
	const h = view[ 1 ] / top[ 1 ];
	const e0 = 0.5 + h / 2 - 0.1;
	const e1 = Math.max( 0.04, 0.5 - h / 2 + 0.12 );
	const p = clamp( ( e0 - Math.abs( d ) ) / Math.max( e0 - e1, 0.05 ) );
	const ny = ( quad[ 1 ] + quad[ 3 ] / 2 ) / view[ 1 ];
	const lead = d > 0 ? ny : 1 - ny;
	const t = clamp( s ) * 0.8 + clamp( lead ) * 0.2;
	const u = clamp( ( p - t * 0.7 ) / 0.3 );
	return 1 - u * u * ( 3 - 2 * u );
};

/** Where the middle of a picture is in its wall, 0 to 1. */
const nx = ( { view, quad }: About ) => ( quad[ 0 ] + quad[ 2 ] / 2 ) / view[ 0 ];
const ny = ( { view, quad }: About ) => ( quad[ 1 ] + quad[ 3 ] / 2 ) / view[ 1 ];
const NX = '( ( uQuad.x + uQuad.z * 0.5 ) / uView.x )';
const NY = '( ( uQuad.y + uQuad.w * 0.5 ) / uView.y )';

/**
 * Darker the more folded: a folded picture turns from the light; and
 * gone when folded all the way, so that a wall comes out of nothing.
 */
const SHADE = ( s: string ) => `
	float f = foldOf( top, ${ s } );
	vec4 c = vec4( color.rgb * ( 1.0 - 0.55 * f ), color.a );
	return c * ( 1.0 - smoothstep( 0.72, 1.0, f ) );`;

/**
 * Turn: column after column, from the left, every picture turns on its
 * upright axis to face you, from edge on.
 */
export const turn = ( { top }: Told ): Effect => {
	const s = NX;
	return {
		params: { top },
		head: AMOUNT,
		vertex: `
	float f = foldOf( top, ${ s } );
	float a = f * 1.5 * foldSide( top );
	return vec3( p.x * cos( a ), p.y, p.z + p.x * sin( a ) - f * 160.0 );`,
		color: SHADE( s ),
		place( p: number[], about: About ) {
			const f = foldOf( top, about, nx( about ) );
			const a = f * 1.5 * sideOf( top, about.view );
			const x = p[ 0 ];
			p[ 0 ] = x * Math.cos( a );
			p[ 2 ] += x * Math.sin( a ) - f * 160;
		},
	};
};

/**
 * Cascade: along the diagonal, from the top left, the pictures come
 * spinning in out of the depth, small, and grow into their places.
 */
export const cascade = ( { top }: Told ): Effect => {
	const s = `( ${ NX } * 0.6 + ${ NY } * 0.4 )`;
	const move = ( p: number[], f: number, side: number, h: number ) => {
		const k = 1 - 0.85 * f;
		const a = f * 1.1 * side;
		const [ x, y ] = p;
		p[ 0 ] = k * ( x * Math.cos( a ) - y * Math.sin( a ) );
		p[ 1 ] = k * ( x * Math.sin( a ) + y * Math.cos( a ) ) + side * f * h * 0.7;
		p[ 2 ] -= f * 260;
	};
	return {
		params: { top },
		head: AMOUNT,
		vertex: `
	float f = foldOf( top, ${ s } );
	float side = foldSide( top );
	float k = 1.0 - 0.85 * f;
	float a = f * 1.1 * side;
	return vec3(
		k * ( p.x * cos( a ) - p.y * sin( a ) ),
		k * ( p.x * sin( a ) + p.y * cos( a ) ) + side * f * uQuad.w * 0.7,
		p.z - f * 260.0
	);`,
		color: SHADE( s ),
		place( p: number[], about: About ) {
			const f = foldOf( top, about, nx( about ) * 0.6 + ny( about ) * 0.4 );
			move( p, f, sideOf( top, about.view ), about.quad[ 3 ] );
		},
	};
};

/**
 * Bloom: from the middle out, the pictures come up out of the depth,
 * tipped away from the middle, and lie flat as they arrive.
 */
export const bloom = ( { top }: Told ): Effect => {
	const parts = ( about: About ) => {
		const dx = ( nx( about ) - 0.5 ) * 2;
		const dy = ( ny( about ) - 0.5 ) * 2;
		return { dx, dy, s: clamp( Math.hypot( dx, dy * 0.8 ) / 1.15 ) };
	};
	return {
		params: { top },
		head: `${ AMOUNT }
	vec2 bloomAt() {
		return vec2( ( ${ NX } - 0.5 ) * 2.0, ( ${ NY } - 0.5 ) * 2.0 );
	}
	float bloomTurn() {
		vec2 c = bloomAt();
		return clamp( length( vec2( c.x, c.y * 0.8 ) ) / 1.15, 0.0, 1.0 );
	}`,
		vertex: `
	vec2 c = bloomAt();
	float f = foldOf( top, bloomTurn() );
	float b = -c.y * f * 1.1;
	float a = c.x * f * 1.1;
	float k = 1.0 - 0.35 * f;
	float y1 = k * p.y * cos( b );
	float z1 = k * p.y * sin( b );
	float x2 = k * p.x * cos( a ) + z1 * sin( a );
	float z2 = -k * p.x * sin( a ) + z1 * cos( a );
	return vec3( x2, y1, p.z + z2 - f * 700.0 );`,
		color: SHADE( 'bloomTurn()' ),
		place( p: number[], about: About ) {
			const { dx, dy, s } = parts( about );
			const f = foldOf( top, about, s );
			const b = -dy * f * 1.1;
			const a = dx * f * 1.1;
			const k = 1 - 0.35 * f;
			const y1 = k * p[ 1 ] * Math.cos( b );
			const z1 = k * p[ 1 ] * Math.sin( b );
			const x2 = k * p[ 0 ] * Math.cos( a ) + z1 * Math.sin( a );
			const z2 = -k * p[ 0 ] * Math.sin( a ) + z1 * Math.cos( a );
			p[ 0 ] = x2;
			p[ 1 ] = y1;
			p[ 2 ] += z2 - f * 700;
		},
	};
};

/**
 * Rain: in an order that seems to be no order, every picture swings down
 * on its top edge, like a card let fall, and hangs flat.
 */
export const rain = ( { top }: Told ): Effect => {
	// A turn for every picture that looks random, but changes smoothly
	// with where it is, so that a wall dragged sideways does not flicker.
	const turnOf = ( { quad }: About ) => {
		const x = ( quad[ 0 ] + quad[ 2 ] / 2 ) / quad[ 2 ];
		const y = ( quad[ 1 ] + quad[ 3 ] / 2 ) / quad[ 3 ];
		return 0.5 + 0.25 * Math.sin( x * 2.3 + y * 1.7 ) + 0.25 * Math.sin( x * 1.13 - y * 2.9 + 1.0 );
	};
	return {
		params: { top },
		head: `${ AMOUNT }
	float rainTurn() {
		float x = ( uQuad.x + uQuad.z * 0.5 ) / uQuad.z;
		float y = ( uQuad.y + uQuad.w * 0.5 ) / uQuad.w;
		return 0.5 + 0.25 * sin( x * 2.3 + y * 1.7 ) + 0.25 * sin( x * 1.13 - y * 2.9 + 1.0 );
	}`,
		vertex: `
	float f = foldOf( top, rainTurn() );
	float side = foldSide( top );
	float a = f * 1.45;
	float hinge = -uQuad.w * 0.5 * side;
	float d = p.y - hinge;
	return vec3( p.x, hinge + d * cos( a ) + side * f * uQuad.w * 0.3, p.z + abs( d ) * sin( a ) * 0.7 );`,
		color: SHADE( 'rainTurn()' ),
		place( p: number[], about: About ) {
			const f = foldOf( top, about, turnOf( about ) );
			const side = sideOf( top, about.view );
			const a = f * 1.45;
			const hinge = ( -about.quad[ 3 ] / 2 ) * side;
			const d = p[ 1 ] - hinge;
			p[ 1 ] = hinge + d * Math.cos( a ) + side * f * about.quad[ 3 ] * 0.3;
			p[ 2 ] += Math.abs( d ) * Math.sin( a ) * 0.7;
		},
	};
};
