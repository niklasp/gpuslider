/**
 * What the visitor does: dragging with any pointer, and the keyboard.
 *
 * A drag belongs to the slider only once it has moved further sideways
 * than up or down. Until then nothing is captured, so a vertical swipe
 * scrolls the page and a click is a click.
 */

// Distance a pointer has to travel before the direction is decided, px.
const SLOP = 4;

// Only the last part of a drag says how fast the pointer was let go, ms.
const RECENT = 100;

// How much of the pointer's way the slider follows past its ends.
const RUBBER = 0.3;

// A wheel or trackpad has stopped when it is silent for this long, ms.
const SILENCE = 90;

const TYPING = 'input, textarea, select, [contenteditable]';
const NO_DRAG = `${ TYPING }, [data-ss-prev], [data-ss-next], [data-ss-dots], [data-ss-pause], [data-ss-no-drag]`;

/**
 * @param {HTMLElement} root   The slider.
 * @param {Object}      slider The slider.
 * @param {AbortSignal} signal Ends the listening.
 */
export function createInput( root, slider, signal ) {
	const win = root.ownerDocument.defaultView;
	const { options, motion } = slider;
	let pointer = null;
	// Ends the listening to the pointer that is down.
	let held;

	const stop = () => {
		held?.abort();
		pointer = null;
	};

	const swallow = ( event ) => {
		event.preventDefault();
		event.stopPropagation();
	};

	function down( event ) {
		if (
			pointer ||
			rolling ||
			! options.drag ||
			! event.isPrimary ||
			event.button > 0 ||
			event.target.closest( NO_DRAG )
		) {
			return;
		}
		pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			from: 0,
			locked: false,
			samples: [],
		};
		// A touch on a moving slider holds it, like a finger on a wheel.
		if ( motion.pos !== motion.target ) {
			lock( event );
		}
		held = new win.AbortController();
		const { signal: until } = held;
		win.addEventListener( 'pointermove', move, { signal: until } );
		win.addEventListener( 'pointerup', up, { signal: until } );
		win.addEventListener( 'pointercancel', up, { signal: until } );
	}

	// Past the ends the slider follows only a part of the way.
	function resist( pos ) {
		const layout = slider.layout();
		if ( layout.loop ) {
			return pos;
		}
		const min = layout.snaps[ 0 ];
		const max = layout.snaps[ layout.snaps.length - 1 ];
		if ( pos < min ) {
			return min + ( pos - min ) * RUBBER;
		}
		return pos > max ? max + ( pos - max ) * RUBBER : pos;
	}

	// Sideways scrolling, by a trackpad or a wheel with shift: the slider
	// follows and comes to rest when the scrolling stops.
	let rolling = 0;
	let rolled = 0;
	let rolledFrom = 0;
	function wheel( event ) {
		if (
			! options.wheel ||
			pointer ||
			Math.abs( event.deltaX ) <= Math.abs( event.deltaY )
		) {
			return;
		}
		// Otherwise the browser goes back in its history.
		event.preventDefault();
		if ( ! rolling ) {
			rolledFrom = motion.pos;
			rolled = motion.pos;
			slider.grab();
		}
		const direction = slider.layout().rtl ? -1 : 1;
		// In lines or pages: about as far as in pixels.
		const unit = event.deltaMode ? 40 : 1;
		rolled += direction * event.deltaX * unit;
		slider.drag( resist( rolled ) );
		win.clearTimeout( rolling );
		rolling = win.setTimeout( () => {
			rolling = 0;
			slider.release( 0, rolledFrom );
		}, SILENCE );
	}

	function lock( event ) {
		pointer.locked = true;
		pointer.x = event.clientX;
		pointer.from = motion.pos;
		slider.grab();
		root.classList.add( 'ss-dragging' );
		try {
			root.setPointerCapture( pointer.id );
		} catch {
			// The pointer is gone already.
		}
	}

	function move( event ) {
		if ( ! pointer || event.pointerId !== pointer.id ) {
			return;
		}
		if ( ! pointer.locked ) {
			const dx = Math.abs( event.clientX - pointer.x );
			const dy = Math.abs( event.clientY - pointer.y );
			if ( dx < SLOP && dy < SLOP ) {
				return;
			}
			if ( dy > dx ) {
				stop();
				return;
			}
			lock( event );
		}
		const direction = slider.layout().rtl ? -1 : 1;
		const pos = resist(
			pointer.from - direction * ( event.clientX - pointer.x )
		);
		const { samples } = pointer;
		samples.push( event.timeStamp, pos );
		while ( samples.length > 4 && event.timeStamp - samples[ 0 ] > RECENT ) {
			samples.splice( 0, 2 );
		}
		slider.drag( pos );
	}

	function up( event ) {
		if ( ! pointer || event.pointerId !== pointer.id ) {
			return;
		}
		const { locked, samples, from } = pointer;
		stop();
		if ( ! locked ) {
			return;
		}
		root.classList.remove( 'ss-dragging' );
		let velocity = 0;
		const n = samples.length;
		// A pointer that rested before it let go has no speed left.
		if ( n >= 4 && event.timeStamp - samples[ n - 2 ] < RECENT ) {
			const time = samples[ n - 2 ] - samples[ 0 ];
			if ( time > 0 ) {
				velocity = ( ( samples[ n - 1 ] - samples[ 1 ] ) / time ) * 1000;
			}
		}
		slider.release( velocity, from );

		// The click that ends a drag is not a click on what is under it.
		if ( Math.abs( motion.pos - from ) > SLOP ) {
			const soon = new win.AbortController();
			root.addEventListener( 'click', swallow, {
				capture: true,
				signal: soon.signal,
			} );
			win.setTimeout( () => soon.abort(), 0 );
		}
	}

	function key( event ) {
		if (
			! options.keyboard ||
			event.defaultPrevented ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.target.closest( TYPING )
		) {
			return;
		}
		const { rtl } = slider.layout();
		const act = {
			ArrowRight: rtl ? slider.prev : slider.next,
			ArrowLeft: rtl ? slider.next : slider.prev,
			Home: () => slider.to( 0 ),
			End: () => slider.to( slider.count() - 1 ),
		}[ event.key ];
		if ( act ) {
			act();
			event.preventDefault();
		}
	}

	// Images and links would start a native drag and drop.
	const native = ( event ) => event.preventDefault();

	root.addEventListener( 'pointerdown', down, { signal } );
	root.addEventListener( 'keydown', key, { signal } );
	root.addEventListener( 'dragstart', native, { signal } );
	root.addEventListener( 'wheel', wheel, { passive: false, signal } );
	signal.addEventListener( 'abort', () => {
		stop();
		win.clearTimeout( rolling );
	} );
}
