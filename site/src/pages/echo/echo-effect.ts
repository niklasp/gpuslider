import type { Effect } from 'gpuslider/effects';

/**
 * How much of a squircle, or of a rounded box, of `size` centred at the
 * origin covers the point `q`: as the canvas rounds a slide, with corners
 * of radius `r` and the exponent `shape` (2 round, 4 a squircle).
 */
const COVER = `
float echoCover_( vec2 q, vec2 size, float r, float shape ) {
	float rr = max( r, 0.001 );
	vec2 d = abs( q ) - size * 0.5 + rr;
	vec2 e = pow( max( d, vec2( 0.0 ) ) / rr, vec2( shape ) );
	float away = pow( e.x + e.y, 1.0 / shape ) * rr + min( max( d.x, d.y ), 0.0 ) - rr;
	return clamp( 0.5 - away, 0.0, 1.0 );
}
`;

// How far behind its slide the echo reaches, in px, and how high it may
// swing: the same sums in the mesh and in the pixels. `D` follows the
// speed, as frames of a film taken at a fixed rate are farther apart the
// faster what they show moves; `b` is the side the slide comes from.
const REACH = `
	float v = trail;
	float m = smoothstep( 0.02, 0.45, abs( v ) );
	float D = min( abs( v ) * uView.x * lag, reach * uQuad.z ) * m;
	float b = v < 0.0 ? -1.0 : 1.0;
	float A = 0.0;`;

/**
 * Echo: a slide that moves leaves frames of itself behind, as a film run
 * slowly does. The copies are drawn by the same pass as the slide, in the
 * mesh of the slide made longer behind it: no element is copied. The
 * faster the slide, the farther apart the frames; at rest there are none.
 *
 * Every parameter is an array of one: the page writes into it and the next
 * frame has it.
 *
 * - `frames`: how many copies, 0 to 12
 * - `trail`: how fast the reel has moved of late, in views per second,
 *   held and let go slowly by `linger()`: the frames follow it, not the
 *   speed of the moment, and so stay a while after the move
 * - `lag`: seconds of movement between the slide and its last frame
 * - `reach`: the longest echo, in widths of the slide
 * - `shrink`: how much smaller each frame is than the one before
 * - `curve`: how far the frames swing up and down, 0 to 1 of the room
 *   their shrinking leaves them within the row
 * - `pitch`: px from a slide to the next, which the page measures: no
 *   frame is drawn over another slide
 * - `turns`: half waves of the swing along the echo
 * - `fade`: how fast the frames fade, the higher the faster
 * - `tint`: how much the frames turn to the warm grey of old film
 */
export const echo = ( params: Record< string, number[] > ): Effect => ( {
	params,
	head: COVER,
	vertex: `${ REACH }
	return vec3(
		p.x * ( uQuad.z + D ) / uQuad.z + b * D * 0.5,
		p.y * ( uQuad.w + 2.0 * A ) / uQuad.w,
		p.z
	);`,
	color: `${ REACH }
	vec2 size = uQuad.zw;
	// Where this pixel is, in px from the middle of the slide at rest.
	float left = -size.x * 0.5 + min( b, 0.0 ) * D;
	vec2 q = vec2( left + uv.x * ( size.x + D ), -size.y * 0.5 - A + uv.y * ( size.y + 2.0 * A ) );
	vec4 sum = media( q / size + 0.5 ) * echoCover_( q, size, uRadius, uShape );
	// Where another slide of the row is, its frames are not: the slides
	// are always seen whole. They follow each other every \`pitch\` px.
	float j = floor( q.x / pitch + 0.5 );
	float open = j == 0.0 ? 1.0 : 1.0 - echoCover_( q - vec2( j * pitch, 0.0 ), size, uRadius, uShape );
	float n = max( frames, 1.0 );
	for ( int k = 1; k <= 12; k++ ) {
		float f = float( k );
		if ( f <= frames ) {
			float s = max( 1.0 - shrink * f, 0.2 );
			// A frame swings up and down no farther than it has shrunk: it
			// stays within the height of the row.
			// It swings by as much as the echo is long: as the trail draws
			// in, its curve flattens with it, the whole of it smaller and
			// fainter, and no frame is left standing out of line.
			float k = clamp( D / max( reach * size.x, 1.0 ), 0.0, 1.0 );
			float swing = curve * sin( PI * turns * f / n ) * ( 1.0 - s ) * size.y * 0.5 * k;
			vec2 at = vec2( b * D * f / n, swing );
			vec2 r = ( q - at ) / s;
			float cover = echoCover_( r, size, uRadius, uShape );
			if ( cover > 0.0 ) {
				vec4 c = media( r / size + 0.5 );
				float grey = dot( c.rgb, vec3( 0.3, 0.55, 0.15 ) );
				float t = tint * f / n;
				c = vec4( mix( c.rgb, grey * vec3( 1.0, 0.86, 0.7 ) * c.a, t ) * ( 1.0 - 0.05 * f ), c.a );
				float a = m * pow( 1.0 - f / ( n + 1.0 ), fade );
				// Swung frames fade before they meet the slide.
				a *= curve > 0.0 ? smoothstep( 0.0, 0.3, k ) : 1.0;
				sum += c * cover * a * open * ( 1.0 - sum.a );
			}
		}
	}
	return sum;`,
} );

/** Ways the frames fall: the parameters of `echo()`, each a number. */
export const WAYS = {
	Frames: { frames: 10, lag: 0.55, reach: 3.2, shrink: 0.045, curve: 0, turns: 1, fade: 0.8, tint: 0.55 },
	Ghost: { frames: 12, lag: 0.4, reach: 2.4, shrink: 0.012, curve: 0, turns: 1, fade: 1.4, tint: 0 },
	Arc: { frames: 10, lag: 0.55, reach: 3, shrink: 0.06, curve: 1, turns: 1, fade: 0.9, tint: 0.3 },
	Spiral: { frames: 12, lag: 0.6, reach: 3.4, shrink: 0.06, curve: 1, turns: 3, fade: 0.85, tint: 0.2 },
};
export type Way = keyof typeof WAYS;

/**
 * Holds the speed of the reel for the frames: it rises with the move at
 * once and falls slowly after it, `fall` seconds to a third. While it falls
 * the slider is asked for frames, so the trail draws in as it goes.
 */
export const linger = ( trail: number[], fall = 0.6 ) => ( slider: { wake: () => void } ) => {
	let held = 0;
	return {
		name: 'linger',
		frame( view: { velocity: number }, dt: number ) {
			const v = view.velocity;
			const kept = held * Math.exp( -dt / fall );
			held = Math.abs( v ) >= Math.abs( kept ) ? v : kept;
			if ( Math.abs( held ) < 0.004 ) {
				held = 0;
			}
			trail[ 0 ] = held;
		},
		busy: () => held !== 0,
		destroy() {
			trail[ 0 ] = 0;
			slider.wake();
		},
	};
};
