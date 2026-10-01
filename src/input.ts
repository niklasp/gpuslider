/**
 * What the visitor does with a pointer: dragging.
 *
 * A drag belongs to the slider only once it has moved further along the
 * way of the slides than across it. Until then nothing is captured, so a
 * swipe across scrolls the page and a click is a click.
 */

// Distance a pointer has to travel before the direction is decided, px.
const SLOP = 4;

// What a hand does while it clicks: a drag shorter than this, px, lets go
// with a click on the slide under it.
const CLICK = 10;

// Only the last part of a drag says how fast the pointer was let go, ms.
const RECENT = 100;

// A drag does not begin on what is there to be used.
const NO_DRAG =
	'input, textarea, select, button, [contenteditable], [data-gs-no-drag]';

import type { Slider } from './index.js';

interface Pointer {
	id: number;
	x: number;
	y: number;
	_from: number;
	_at?: number;
	_locked: boolean;
	_held?: boolean;
	_taken?: boolean;
	_samples: number[];
}

/**
 * @param root The slider.
 * @param slider The slider.
 * @param signal Ends the listening.
 */
export function createInput( root: HTMLElement, slider: Slider, signal: AbortSignal ) {
	const win = root.ownerDocument.defaultView!;
	const { options, motion } = slider;
	let pointer: Pointer | null = null;
	// Ends the listening to the pointer that is down.
	let held: AbortController | undefined;

	const stop = () => {
		held?.abort();
		pointer = null;
	};

	const swallow = ( event: Event ) => {
		event.preventDefault();
		event.stopPropagation();
	};

	function down( event: PointerEvent ) {
		if (
			pointer ||
			motion.dragging ||
			! options.drag ||
			! event.isPrimary ||
			event.button > 0 ||
			( event.target as Element ).closest( NO_DRAG )
		) {
			return;
		}
		pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			_from: 0,
			_locked: false,
			_samples: [],
		};
		// A touch on a moving slider holds it, like a finger on a wheel.
		// The pointer is not taken yet: what it lets go of at once is a
		// click on the slide under it.
		if ( motion.pos !== motion.target ) {
			pointer._held = true;
			pointer._from = motion.pos;
			slider.grab();
		}
		held = new win.AbortController();
		const { signal: until } = held;
		win.addEventListener( 'pointermove', move, { signal: until } );
		win.addEventListener( 'pointerup', up, { signal: until } );
		win.addEventListener( 'pointercancel', up, { signal: until } );
	}

	// Where a pointer is on the way of the slides.
	const along = ( event: PointerEvent ) =>
		slider.layout().y ? event.clientY : event.clientX;

	function lock( event: PointerEvent ) {
		pointer!._locked = true;
		pointer!._at = along( event );
		pointer!._from = motion.pos;
		slider.grab();
		root.classList.add( 'gs-dragging' );
	}

	function move( event: PointerEvent ) {
		if ( ! pointer || event.pointerId !== pointer.id ) {
			return;
		}
		if ( ! pointer._locked ) {
			const dx = Math.abs( event.clientX - pointer.x );
			const dy = Math.abs( event.clientY - pointer.y );
			if ( dx < SLOP && dy < SLOP ) {
				return;
			}
			if ( ! pointer._held && ( slider.layout().y ? dx > dy : dy > dx ) ) {
				stop();
				return;
			}
			lock( event );
		}
		// The pointer is the slider's once it is surely a drag: before, the
		// click it may still be goes to the slide under it.
		if ( ! pointer._taken && Math.abs( along( event ) - pointer._at! ) > CLICK ) {
			pointer._taken = true;
			try {
				root.setPointerCapture( pointer.id );
			} catch {
				// The pointer is gone already.
			}
		}
		const direction = slider.layout().rtl ? -1 : 1;
		slider.drag( pointer._from - direction * ( along( event ) - pointer._at! ) );
		const { _samples: samples } = pointer;
		samples.push( event.timeStamp, motion.pos );
		while ( samples.length > 4 && event.timeStamp - samples[ 0 ] > RECENT ) {
			samples.splice( 0, 2 );
		}
	}

	function up( event: PointerEvent ) {
		if ( ! pointer || event.pointerId !== pointer.id ) {
			return;
		}
		const { _locked: locked, _held: was, _samples: samples, _from: from } = pointer;
		stop();
		if ( ! locked ) {
			// Held and let go: to the snap that is nearest.
			if ( was ) {
				slider.release( 0, from );
			}
			return;
		}
		root.classList.remove( 'gs-dragging' );
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
		if ( Math.abs( motion.pos - from ) > CLICK ) {
			const soon = new win.AbortController();
			root.addEventListener( 'click', swallow, {
				capture: true,
				signal: soon.signal,
			} );
			win.setTimeout( () => soon.abort(), 0 );
		}
	}

	// Images and links would start a native drag and drop.
	const native = ( event: Event ) => event.preventDefault();

	root.addEventListener( 'pointerdown', down, { signal } );
	root.addEventListener( 'dragstart', native, { signal } );
	signal.addEventListener( 'abort', stop );
}
