/**
 * Puts the slide elements where the motion says they are, and tells
 * assistive technology what they are.
 *
 * The track moves as a whole (one style per frame). When looping, a slide
 * that left on one side is set down on the other by its own transform,
 * which only changes at that moment.
 */

import type { Layout } from './layout.js';
import type { Motion } from './engine.js';
import type { Place } from './index.js';

/**
 * @param root The slider.
 * @param track Parent of the slides.
 * @param slides The slides.
 * @return `frame( layout, motion, places )`,
 *         `settle( places )`, `destroy()`.
 */
export function createDom( root: HTMLElement, track: HTMLElement, slides: HTMLElement[] ) {
	const win = root.ownerDocument.defaultView!;
	const n = slides.length;
	// What each slide's style holds, to write only what changes.
	const shift: number[] = new Array( n ).fill( 0 );
	const given: [ HTMLElement, string ][] = [];
	// A label like the ones given here came with a copy of a slide.
	const own = /^\d+ \/ \d+$/;
	const attribute = ( el: HTMLElement, name: string, value: string ) => {
		if ( ! el.hasAttribute( name ) || own.test( el.getAttribute( name )! ) ) {
			el.setAttribute( name, value );
			given.push( [ el, name ] );
		}
	};
	attribute( root, 'role', 'region' );
	attribute( root, 'aria-roledescription', 'carousel' );
	// Says which slide is there when it changes; autoplay turns it off.
	attribute( track, 'aria-live', 'polite' );
	slides.forEach( ( slide, i ) => {
		attribute( slide, 'role', 'group' );
		attribute( slide, 'aria-roledescription', 'slide' );
		attribute( slide, 'aria-label', `${ i + 1 } / ${ n }` );
	} );

	return {
		/** How far each slide is moved by its own transform. */
		moved: shift,

		/**
		 * @param layout Layout.
		 * @param motion Motion.
		 * @param places Where each slide is (see `place()`).
		 */
		frame( layout: Layout, motion: Motion, places: Place[] ) {
			const { stack, rtl, y, left } = layout;
			const to = ( by: number ) =>
				y
					? `translate3d(0,${ by }px,0)`
					: `translate3d(${ rtl ? -by : by }px,0,0)`;
			// They lie on top of each other: nothing to move.
			if ( stack ) {
				return;
			}
			// At rest on whole device pixels, so text stays sharp.
			const resting = motion.pos === motion.target && ! motion.dragging;
			const ratio = win.devicePixelRatio || 1;
			const snap = ( value: number ) =>
				resting ? Math.round( value * ratio ) / ratio : value;
			for ( let i = 0; i < n; i++ ) {
				// Whole rounds of the loop, without the noise of the sum.
				const by =
					Math.round(
						( places[ i ].x + motion.pos - left[ i ] ) * 100
					) / 100;
				if ( by !== shift[ i ] ) {
					shift[ i ] = by;
					slides[ i ].style.transform = by ? to( by ) : '';
				}
			}
			track.style.transform = to( snap( -motion.pos ) );
		},

		/**
		 * The slider came to rest: slides out of view leave the tab order
		 * and the accessibility tree.
		 *
		 * @param places Where each slide is.
		 */
		settle( places: Place[] ) {
			for ( let i = 0; i < n; i++ ) {
				const active = places[ i ].visible;
				if ( slides[ i ].inert === active ) {
					slides[ i ].inert = ! active;
				}
			}
		},

		destroy() {
			given.forEach( ( [ el, name ] ) => el.removeAttribute( name ) );
			track.style.transform = '';
			slides.forEach( ( slide ) => {
				slide.style.transform = '';
				slide.inert = false;
			} );
		},
	};
}
