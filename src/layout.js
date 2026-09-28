/**
 * Where the slides are and where the slider can stop.
 *
 * All positions are logical px along the reading direction: 0 is the start
 * edge of the track, so right-to-left pages need nothing special past
 * `measure()`.
 *
 * @typedef {Object} Layout
 * @property {boolean}  stack  Slides lie on top of each other.
 * @property {boolean}  rtl    Reading direction is right to left.
 * @property {boolean}  loop   Whether the slider loops (false when the option
 *                             is on but there are too few slides for it).
 * @property {number}   width  Width of the viewport.
 * @property {number}   height Height of the viewport.
 * @property {number}   gap    Gap between slides.
 * @property {number}   length Length of one round when looping.
 * @property {number[]} left   Start edge of each slide.
 * @property {number[]} size   Width of each slide.
 * @property {number[]} rest   Start edge of each slide in the viewport when
 *                             the slider rests on it.
 * @property {number[]} snaps  Positions the slider can stop at.
 * @property {number[]} snapOf The snap each slide belongs to.
 */

export const mod = ( value, n ) => ( ( value % n ) + n ) % n;

const ALIGN = { start: 0, center: 0.5, end: 1 };

/**
 * Reads the layout from the page, in fractions of a pixel: slides that are
 * a third of the view wide would otherwise drift apart by their rounding.
 *
 * @param {HTMLElement}   root    The slider: its box is the viewport.
 * @param {HTMLElement}   track   Parent of the slides.
 * @param {HTMLElement[]} slides  The slides.
 * @param {Object}        options Slider options.
 * @param {number[]}      [moved] How far each slide is moved by its own
 *                                transform at the moment.
 * @return {Layout} Layout.
 */
export function measure( root, track, slides, options, moved = [] ) {
	const style = root.ownerDocument.defaultView.getComputedStyle( track );
	const rtl = style.direction === 'rtl';
	const stack = options.mode === 'stack';
	const box = root.getBoundingClientRect();
	const around = track.getBoundingClientRect();
	// Boxes are measured as drawn: inside a scaled parent they are scaled.
	const scale = root.offsetWidth ? box.width / root.offsetWidth || 1 : 1;
	const width =
		box.width / scale - ( root.offsetWidth - root.clientWidth );
	const height =
		box.height / scale - ( root.offsetHeight - root.clientHeight );
	const gap = stack ? 0 : parseFloat( style.columnGap ) || 0;
	const left = [];
	const size = [];
	slides.forEach( ( el, i ) => {
		if ( stack ) {
			left.push( i * width );
			size.push( width );
			return;
		}
		const r = el.getBoundingClientRect();
		const from = rtl ? around.right - r.right : r.left - around.left;
		left.push( from / scale - ( moved[ i ] || 0 ) );
		size.push( r.width / scale );
	} );
	return arrange( { stack, rtl, width, height, gap, left, size }, options );
}

/**
 * Derives the snap points from the measured slides.
 *
 * @param {Object} measured `stack`, `rtl`, `width`, `height`, `gap`, `left`,
 *                          `size`.
 * @param {Object} options  Slider options: `loop`, `align`, `group`,
 *                          `contain`.
 * @return {Layout} Layout.
 */
export function arrange( measured, options ) {
	const { width, gap, left, size } = measured;
	const n = left.length;
	const align = ALIGN[ options.align ] ?? 0;
	const end = n ? left[ n - 1 ] + size[ n - 1 ] : 0;
	const length = end + gap - ( n ? left[ 0 ] : 0 );
	// A slide must never be needed at both ends of the viewport at once.
	const loop =
		!! options.loop && n > 1 && length >= width + Math.max( ...size ) - 0.5;
	const group = Math.max( 1, Math.round( options.group || 1 ) );
	const max = Math.max( 0, end - width );
	const contain = ! loop && options.contain !== false;

	const rest = left.map( ( l, i ) => align * ( width - size[ i ] ) );
	const snaps = [];
	const snapOf = [];
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
 * @param {Layout} layout Layout.
 * @param {number} index  Snap index.
 * @return {number} Position.
 */
export function positionOf( layout, index ) {
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
 * @param {Layout} layout   Layout.
 * @param {number} position Position.
 * @return {number} Snap index, running on past both ends when looping.
 */
export function nearest( layout, position ) {
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
 * @param {Layout}   layout   Layout.
 * @param {number}   position Position of the slider.
 * @param {Object[]} out      One object per slide, filled with `x` (start
 *                            edge in the viewport), `p` (distance from its
 *                            resting place in slides: 1 is one slide after
 *                            the active one) and `visible`.
 * @return {Object[]} `out`.
 */
export function place( layout, position, out ) {
	const { stack, loop, length, width, gap, left, size, rest } = layout;
	const n = left.length;
	for ( let i = 0; i < n; i++ ) {
		const slide = out[ i ];
		if ( stack ) {
			let p = i - position / width;
			if ( loop ) {
				p = mod( p + n / 2, n ) - n / 2;
			}
			slide.x = 0;
			slide.p = p;
			slide.visible = Math.abs( p ) < 1;
			continue;
		}
		let x = left[ i ] - position;
		if ( loop ) {
			// Wrapped by its centre, to the round that is closest to the
			// middle of the viewport.
			const centre = x + size[ i ] / 2 - width / 2;
			x += mod( centre + length / 2, length ) - length / 2 - centre;
		}
		slide.x = x;
		slide.p = ( x - rest[ i ] ) / ( size[ i ] + gap || 1 );
		slide.visible = x + size[ i ] > 0 && x < width;
	}
	return out;
}
