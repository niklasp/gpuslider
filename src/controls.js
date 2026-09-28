/**
 * Arrows, dots and the button that stops autoplay: finds `[data-ss-prev]`,
 * `[data-ss-next]`, `[data-ss-dots]` and `[data-ss-pause]` and keeps them
 * in step with the slider.
 *
 * The dots container is filled with one button per snap.
 */

/**
 * @param {HTMLElement} scope  Where to look for the controls.
 * @param {Object}      slider The slider.
 * @return {Object} `update()`, `destroy()`.
 */
export function createControls( scope, slider ) {
	const doc = scope.ownerDocument;
	const prev = [ ...scope.querySelectorAll( '[data-ss-prev]' ) ];
	const next = [ ...scope.querySelectorAll( '[data-ss-next]' ) ];
	const dots = [ ...scope.querySelectorAll( '[data-ss-dots]' ) ];
	const pause = [ ...scope.querySelectorAll( '[data-ss-pause]' ) ];
	const toggle = () => slider[ slider.paused ? 'play' : 'pause' ]();
	pause.forEach( ( el ) => el.addEventListener( 'click', toggle ) );
	const back = () => slider.prev();
	const forward = () => slider.next();
	prev.forEach( ( el ) => el.addEventListener( 'click', back ) );
	next.forEach( ( el ) => el.addEventListener( 'click', forward ) );

	const pick = ( event ) => {
		const dot = event.target.closest( '[data-ss-dot]' );
		if ( dot ) {
			slider.to( Number( dot.dataset.ssDot ) );
		}
	};
	dots.forEach( ( el ) => el.addEventListener( 'click', pick ) );

	let drawn = -1;

	return {
		/** After a change of the slide or of the layout. */
		update() {
			const count = slider.count();
			const { index } = slider;
			const { loop } = slider.layout();
			if ( count !== drawn ) {
				drawn = count;
				dots.forEach( ( el ) => {
					el.replaceChildren(
						...Array.from( { length: count }, ( _, i ) => {
							const dot = doc.createElement( 'button' );
							dot.type = 'button';
							dot.className = 'ss-dot';
							dot.dataset.ssDot = i;
							dot.setAttribute( 'aria-label', `${ i + 1 }` );
							return dot;
						} )
					);
					el.hidden = count < 2;
				} );
			}
			dots.forEach( ( el ) =>
				[ ...el.children ].forEach( ( dot, i ) => {
					if ( i === index ) {
						dot.setAttribute( 'aria-current', 'true' );
					} else {
						dot.removeAttribute( 'aria-current' );
					}
				} )
			);
			pause.forEach( ( el ) =>
				el.setAttribute( 'aria-pressed', String( slider.paused ) )
			);
			prev.forEach( ( el ) => {
				el.disabled = ! loop && index <= 0;
			} );
			next.forEach( ( el ) => {
				el.disabled = ! loop && index >= count - 1;
			} );
		},

		destroy() {
			pause.forEach( ( el ) =>
				el.removeEventListener( 'click', toggle )
			);
			prev.forEach( ( el ) => el.removeEventListener( 'click', back ) );
			next.forEach( ( el ) =>
				el.removeEventListener( 'click', forward )
			);
			dots.forEach( ( el ) => {
				el.removeEventListener( 'click', pick );
				el.replaceChildren();
			} );
		},
	};
}
