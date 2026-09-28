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

const TYPING = 'input, textarea, select, [contenteditable]';
const NO_DRAG = `${ TYPING }, [data-ss-prev], [data-ss-next], [data-ss-dots], [data-ss-no-drag]`;

/**
 * @param {HTMLElement} root   The slider.
 * @param {Object}      slider What the input drives: `motion`, `layout()`,
 *                             `options`, `grab()`, `drag( pos )`,
 *                             `release( velocity, from )`, `next()`,
 *                             `prev()`, `to( index )`, `count()`.
 * @return {Function} Removes the listeners.
 */
export function createInput( root, slider ) {
	const win = root.ownerDocument.defaultView;
	const { options, motion } = slider;
	let pointer = null;

	const stop = () => {
		win.removeEventListener( 'pointermove', move );
		win.removeEventListener( 'pointerup', up );
		win.removeEventListener( 'pointercancel', up );
		pointer = null;
	};

	const swallow = ( event ) => {
		event.preventDefault();
		event.stopPropagation();
	};

	function down( event ) {
		if (
			pointer ||
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
		win.addEventListener( 'pointermove', move );
		win.addEventListener( 'pointerup', up );
		win.addEventListener( 'pointercancel', up );
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
		const layout = slider.layout();
		const direction = layout.rtl ? -1 : 1;
		let pos = pointer.from - direction * ( event.clientX - pointer.x );
		if ( ! layout.loop ) {
			const min = layout.snaps[ 0 ];
			const max = layout.snaps[ layout.snaps.length - 1 ];
			if ( pos < min ) {
				pos = min + ( pos - min ) * RUBBER;
			} else if ( pos > max ) {
				pos = max + ( pos - max ) * RUBBER;
			}
		}
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
			root.addEventListener( 'click', swallow, {
				capture: true,
				once: true,
			} );
			win.setTimeout(
				() => root.removeEventListener( 'click', swallow, true ),
				0
			);
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
		const forward = slider.layout().rtl ? 'ArrowLeft' : 'ArrowRight';
		const back = slider.layout().rtl ? 'ArrowRight' : 'ArrowLeft';
		if ( event.key === forward ) {
			slider.next();
		} else if ( event.key === back ) {
			slider.prev();
		} else if ( event.key === 'Home' ) {
			slider.to( 0 );
		} else if ( event.key === 'End' ) {
			slider.to( slider.count() - 1 );
		} else {
			return;
		}
		event.preventDefault();
	}

	// Images and links would start a native drag and drop.
	const native = ( event ) => event.preventDefault();

	root.addEventListener( 'pointerdown', down );
	root.addEventListener( 'keydown', key );
	root.addEventListener( 'dragstart', native );

	return () => {
		stop();
		root.removeEventListener( 'pointerdown', down );
		root.removeEventListener( 'keydown', key );
		root.removeEventListener( 'dragstart', native );
	};
}
