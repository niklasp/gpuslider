/**
 * Puts the slide elements where the motion says they are, and tells
 * assistive technology what they are.
 *
 * Row: the track moves as a whole (one style per frame). When looping, a
 * slide that left on one side is set down on the other by its own
 * transform, which only changes at that moment.
 *
 * Stack: nothing moves. The two slides around the position are shown, the
 * later one on top with the fraction of the position as its opacity.
 */

/**
 * @param {HTMLElement}   root   The slider.
 * @param {HTMLElement}   track  Parent of the slides.
 * @param {HTMLElement[]} slides The slides.
 * @return {Object} `frame( layout, motion, places )`,
 *                  `settle( places )`, `destroy()`.
 */
export function createDom( root, track, slides ) {
	const win = root.ownerDocument.defaultView;
	const n = slides.length;
	// What each slide's style holds, to write only what changes.
	const shift = new Array( n ).fill( 0 );
	const shown = new Array( n ).fill( -1 );
	const given = [];
	// A label like the ones given here came with a copy of a slide.
	const own = /^\d+ \/ \d+$/;
	const attribute = ( el, name, value ) => {
		if ( ! el.hasAttribute( name ) || own.test( el.getAttribute( name ) ) ) {
			el.setAttribute( name, value );
			given.push( [ el, name ] );
		}
	};
	attribute( root, 'role', 'region' );
	attribute( root, 'aria-roledescription', 'carousel' );
	slides.forEach( ( slide, i ) => {
		attribute( slide, 'role', 'group' );
		attribute( slide, 'aria-roledescription', 'slide' );
		attribute( slide, 'aria-label', `${ i + 1 } / ${ n }` );
	} );

	return {
		/** How far each slide is moved by its own transform. */
		moved: shift,

		/**
		 * @param {Object}   layout Layout.
		 * @param {Object}   motion Motion.
		 * @param {Object[]} places Where each slide is (see `place()`).
		 */
		frame( layout, motion, places ) {
			const { stack, rtl, left } = layout;
			const direction = rtl ? -1 : 1;
			if ( stack ) {
				for ( let i = 0; i < n; i++ ) {
					const { p } = places[ i ];
					// 1 on its place, 0 one slide away. The slide that comes
					// in is on top; the one below stays opaque so nothing
					// behind the two shines through half way.
					const near = Math.max( 0, 1 - Math.abs( p ) );
					const value = Math.round( near * 1000 ) / 1000;
					if ( value === shown[ i ] ) {
						continue;
					}
					shown[ i ] = value;
					const { style } = slides[ i ];
					style.visibility = value ? '' : 'hidden';
					style.zIndex = p > 0 ? 1 : 0;
					style.setProperty( '--ss-near', value );
					style.setProperty( '--ss-cover', p > 0 ? value : 1 );
				}
				return;
			}
			// At rest on whole device pixels, so text stays sharp.
			const resting = motion.pos === motion.target && ! motion.dragging;
			const ratio = win.devicePixelRatio || 1;
			const snap = ( value ) =>
				resting ? Math.round( value * ratio ) / ratio : value;
			for ( let i = 0; i < n; i++ ) {
				// Whole rounds of the loop, without the noise of the sum.
				const by =
					Math.round(
						( places[ i ].x + motion.pos - left[ i ] ) * 100
					) / 100;
				if ( by !== shift[ i ] ) {
					shift[ i ] = by;
					slides[ i ].style.transform = by
						? `translate3d(${ direction * by }px,0,0)`
						: '';
				}
			}
			track.style.transform = `translate3d(${
				direction * snap( -motion.pos )
			}px,0,0)`;
		},

		/**
		 * The slider came to rest: slides out of view leave the tab order
		 * and the accessibility tree.
		 *
		 * @param {Object[]} places Where each slide is.
		 */
		settle( places ) {
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
			slides.forEach( ( { style } ) => {
				style.transform = '';
				style.visibility = '';
				style.zIndex = '';
				style.removeProperty( '--ss-near' );
				style.removeProperty( '--ss-cover' );
			} );
			slides.forEach( ( slide ) => {
				slide.inert = false;
			} );
		},
	};
}
