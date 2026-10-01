/**
 * Where the slides are and where the slider can stop.
 *
 * All positions are logical px along the way of the slides: 0 is the start
 * edge of the track. Right-to-left pages and sliders that go down need
 * nothing special past `measure()`.
 *
 */

import type { Options, Place } from './index.js';

/** What `measure()` reads of the page; plugins may change it to lay out. */
export interface Measured {
	/** Slides lie on top of each other: the `stack` plugin says so. */
	stack?: boolean;
	/** The slides follow each other downwards. */
	y: boolean;
	/** Reading direction is right to left. */
	rtl: boolean;
	/** Width of the viewport. */
	width: number;
	/** Height of the viewport. */
	height: number;
	/**
	 * Its length along the way of the slides: the width, or the height of a
	 * slider that goes down.
	 */
	span: number;
	/** Gap between slides. */
	gap: number;
	/** Start edge of each slide. */
	left: number[];
	/** Width of each slide. */
	size: number[];
}

export interface Layout extends Measured {
	/**
	 * Whether the slider loops (false when the option is on but there are
	 * too few slides for it).
	 */
	loop: boolean;
	/** Length of one round when looping. */
	length: number;
	/**
	 * Start edge of each slide in the viewport when the slider rests on it.
	 */
	rest: number[];
	/** Positions the slider can stop at. */
	snaps: number[];
	/** The snap each slide belongs to. */
	snapOf: number[];
}

export const mod = ( value: number, n: number ) => ( ( value % n ) + n ) % n;

const ALIGN: Record< string, number > = { start: 0, center: 0.5, end: 1 };

// How much of the pointer's way the slider follows past its ends.
const RUBBER = 0.3;

/**
 * Reads the layout from the page, in fractions of a pixel: slides that are
 * a third of the view wide would otherwise drift apart by their rounding.
 *
 * @param root The slider: its box is the viewport.
 * @param track Parent of the slides.
 * @param slides The slides.
 * @param options Slider options.
 * @param moved How far each slide is moved by its own
 *              transform at the moment.
 * @param shape Gets what was measured and may change it:
 *              for plugins that lay out another way.
 * @return Layout.
 */
export function measure( root: HTMLElement, track: HTMLElement, slides: HTMLElement[], options: Options, moved: number[] = [], shape?: ( measured: Measured ) => void ): Layout {
	const style = root.ownerDocument.defaultView!.getComputedStyle( track );
	const y = options.axis === 'y';
	const rtl = ! y && style.direction === 'rtl';
	const box = root.getBoundingClientRect();
	const around = track.getBoundingClientRect();
	// Boxes are measured as drawn: inside a scaled parent they are scaled.
	const scale = root.offsetWidth ? box.width / root.offsetWidth || 1 : 1;
	const width =
		box.width / scale - ( root.offsetWidth - root.clientWidth );
	const height =
		box.height / scale - ( root.offsetHeight - root.clientHeight );
	const gap = parseFloat( y ? style.rowGap : style.columnGap ) || 0;
	const left: number[] = [];
	const size: number[] = [];
	slides.forEach( ( el, i ) => {
		const r = el.getBoundingClientRect();
		let from = rtl ? around.right - r.right : r.left - around.left;
		if ( y ) {
			from = r.top - around.top;
		}
		left.push( from / scale - ( moved[ i ] || 0 ) );
		size.push( ( y ? r.height : r.width ) / scale );
	} );
	const span = y ? height : width;
	const measured: Measured = { y, rtl, width, height, span, gap, left, size };
	shape?.( measured );
	return arrange( measured, options );
}

/**
 * Derives the snap points from the measured slides.
 *
 * @param measured `y`, `rtl`, `width`, `height`, `span`, `gap`,
 *                 `left`, `size`.
 * @param options Slider options: `loop`, `align`, `group`,
 *                `contain`.
 * @return Layout.
 */
export function arrange( measured: Measured, options: Options ): Layout {
	const { span: width, gap, left, size } = measured;
	const n = left.length;
	const align = ALIGN[ options.align! ] ?? 0;
	const end = n ? left[ n - 1 ] + size[ n - 1 ] : 0;
	const length = end + gap - ( n ? left[ 0 ] : 0 );
	// A slide must never be needed at both ends of the viewport at once.
	const loop =
		!! options.loop && n > 1 && length >= width + Math.max( ...size ) - 0.5;
	const group = Math.max( 1, Math.round( options.group || 1 ) );
	const max = Math.max( 0, end - width );
	const contain = ! loop && options.contain !== false;

	const rest = left.map( ( _l, i ) => align * ( width - size[ i ] ) );
	const snaps: number[] = [];
	const snapOf: number[] = [];
	for ( let i = 0; i < n; i++ ) {
		if ( i % group === 0 ) {
			let snap = left[ i ] - rest[ i ];
			if ( contain ) {
				snap = Math.min( max, Math.max( 0, snap ) );
			}
			// Slides at the end that cannot scroll any further share a snap.
			if ( ! snaps.length || snap - snaps[ snaps.length - 1 ] > 0.5 ) {
				snaps.push( snap );
			}
		}
		snapOf.push( snaps.length - 1 );
	}
	if ( ! snaps.length ) {
		snaps.push( 0 );
	}
	return { ...measured, loop, length, rest, snaps, snapOf };
}

/**
 * The position of a snap. When looping, indexes run on past both ends:
 * -1 is the last snap one round before.
 *
 * @param layout Layout.
 * @param index Snap index.
 * @return Position.
 */
export function positionOf( layout: Layout, index: number ): number {
	const { snaps, loop, length } = layout;
	const n = snaps.length;
	if ( ! loop ) {
		return snaps[ Math.min( n - 1, Math.max( 0, index ) ) ];
	}
	return snaps[ mod( index, n ) ] + Math.floor( index / n ) * length;
}

/**
 * The snap closest to a position.
 *
 * @param layout Layout.
 * @param position Position.
 * @return Snap index, running on past both ends when looping.
 */
export function nearest( layout: Layout, position: number ): number {
	const { snaps, loop, length } = layout;
	const n = snaps.length;
	const round = loop ? Math.floor( position / length ) : 0;
	let best = 0;
	let distance = Infinity;
	for ( let r = loop ? round - 1 : 0; r <= ( loop ? round + 1 : 0 ); r++ ) {
		for ( let i = 0; i < n; i++ ) {
			const d = Math.abs( snaps[ i ] + r * length - position );
			if ( d < distance ) {
				distance = d;
				best = i + r * n;
			}
		}
	}
	return best;
}

/**
 * Where each slide is for a position.
 *
 * @param layout Layout.
 * @param position Position of the slider.
 * @param out One object per slide, filled with `x` (start
 *            edge in the viewport), `p` (distance from its
 *            resting place in slides: 1 is one slide after
 *            the active one), `share` (how much of it is in
 *            the view, 0 to 1) and `visible`.
 * @return `out`.
 */
export function place( layout: Layout, position: number, out: Place[] ): Place[] {
	const { loop, length, span: width, gap, left, size, rest } = layout;
	const n = left.length;
	for ( let i = 0; i < n; i++ ) {
		const slide = out[ i ];
		let x = left[ i ] - position;
		if ( loop ) {
			// Wrapped by its centre, to the round that is closest to the
			// middle of the viewport.
			const centre = x + size[ i ] / 2 - width / 2;
			x += mod( centre + length / 2, length ) - length / 2 - centre;
		}
		slide.x = x;
		slide.p = ( x - rest[ i ] ) / ( size[ i ] + gap || 1 );
		slide.share = Math.max(
			0,
			Math.min(
				1,
				( Math.min( x + size[ i ], width ) - Math.max( x, 0 ) ) /
					( size[ i ] || 1 )
			)
		);
		slide.visible = x + size[ i ] > 0 && x < width;
	}
	return out;
}

/**
 * Past its ends a slider follows only a part of the way.
 *
 * @param layout Layout.
 * @param position Where the pointer would have it.
 * @return Where it is.
 */
export function resist( layout: Layout, position: number ): number {
	const { snaps, loop } = layout;
	const to = Math.min(
		snaps[ snaps.length - 1 ],
		Math.max( snaps[ 0 ], position )
	);
	return loop ? position : to + ( position - to ) * RUBBER;
}
