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
	// Videos play while their slide is in the view, and only then.
	const videos = slides.map( ( slide ) => [
		...slide.querySelectorAll( 'video' ),
	] );
	const playing = new Array( n ).fill( null );
	// Videos that start by themselves would do so wherever they are: the
	// slider starts them instead.
	const self = videos.flat().filter( ( video ) => video.autoplay );
	const resume = new WeakSet( self );
	self.forEach( ( video ) => {
		video.autoplay = false;
		video.pause();
	} );
	const play = ( i, on ) => {
		if ( on === playing[ i ] ) {
			return;
		}
		playing[ i ] = on;
		videos[ i ].forEach( ( video ) => {
			if ( ! on ) {
				if ( ! video.paused ) {
					resume.add( video );
					video.pause();
				}
			} else if ( resume.has( video ) ) {
				resume.delete( video );
				// Refused without a gesture, unless the video is muted.
				video.play()?.catch( () => {} );
			}
		} );
	};

	const given = [];
	const attribute = ( el, name, value ) => {
		if ( ! el.hasAttribute( name ) ) {
			el.setAttribute( name, value );
			given.push( [ el, name ] );
		}
	};
	attribute( root, 'role', 'region' );
	attribute( root, 'aria-roledescription', 'carousel' );
	attribute( root, 'tabindex', '0' );
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
		 * @param {boolean}  awake  Whether the slider is on the screen.
		 */
		frame( layout, motion, places, awake ) {
			const { stack, rtl, left } = layout;
			const direction = rtl ? -1 : 1;
			for ( let i = 0; i < n; i++ ) {
				if ( videos[ i ].length ) {
					play( i, awake && places[ i ].visible );
				}
			}
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
			self.forEach( ( video ) => {
				video.autoplay = true;
			} );
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
