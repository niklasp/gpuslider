/**
 * Arrows, dots and the button that stops autoplay, wherever they are on
 * the page.
 *
 * In the slider, or in the element given as `controls`:
 *
 *     <button data-ss-prev>, <button data-ss-next>, <button data-ss-pause>
 *     <div data-ss-dots>         filled with one button per snap
 *     <button data-ss-to="2">    goes to a snap
 *
 * Anywhere else, with the id of the slider on them or around them:
 *
 *     <nav data-ss-for="photos"><button data-ss-next>…</button></nav>
 *
 * Or given as options `prev`, `next`, `pause`, `dots`: an element, several,
 * or a selector.
 *
 * Clicks are heard on the document, so controls that come later work too.
 */

/**
 * @param {HTMLElement} root    The slider element.
 * @param {Object}      slider  The slider.
 * @param {Object}      options Its options.
 * @param {AbortSignal} signal  Ends the listening.
 * @return {Object} `update()`, `destroy()`.
 */
export function createControls( root, slider, options, signal ) {
	const doc = root.ownerDocument;

	const given = ( value ) =>
		typeof value === 'string'
			? [ ...doc.querySelectorAll( value ) ]
			: [ value ].flat().filter( Boolean );

	// Whether an element of the page speaks to this slider.
	const mine = ( el ) => {
		const to = el.closest( '[data-ss-for]' );
		if ( to ) {
			return !! root.id && to.dataset.ssFor === root.id;
		}
		const scope = options.controls || root;
		// Not what belongs to a slider inside of this one.
		return scope.contains( el ) && ( el.closest( '.ss' ) || root ) === root;
	};

	const all = ( kind ) => [
		...new Set( [
			...[ ...doc.querySelectorAll( `[data-ss-${ kind }]` ) ].filter( mine ),
			...given( options[ kind ] ),
		] ),
	];

	const act = {
		prev: slider.prev,
		next: slider.next,
		pause: () => slider[ slider.paused ? 'play' : 'pause' ](),
	};

	const click = ( event ) => {
		const { target } = event;
		if ( ! target.closest ) {
			return;
		}
		for ( const kind in act ) {
			if ( all( kind ).some( ( el ) => el.contains( target ) ) ) {
				act[ kind ]();
				return;
			}
		}
		const to = target.closest( '[data-ss-dot], [data-ss-to]' );
		if (
			to &&
			( to.dataset.ssTo
				? mine( to )
				: all( 'dots' ).some( ( el ) => el.contains( to ) ) )
		) {
			slider.to( Number( to.dataset.ssTo ?? to.dataset.ssDot ) );
		}
	};
	doc.addEventListener( 'click', click, { signal } );

	const filled = new Set();
	const mark = ( el, on ) =>
		on
			? el.setAttribute( 'aria-current', 'true' )
			: el.removeAttribute( 'aria-current' );

	return {
		/** After a change of the slide or of the layout. */
		update() {
			const count = slider.count();
			const { index } = slider;
			all( 'dots' ).forEach( ( el ) => {
				if ( el.children.length !== count || ! filled.has( el ) ) {
					filled.add( el );
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
				}
				[ ...el.children ].forEach( ( dot, i ) => mark( dot, i === index ) );
			} );
			doc.querySelectorAll( '[data-ss-to]' ).forEach( ( el ) => {
				if ( mine( el ) ) {
					mark( el, Number( el.dataset.ssTo ) === index );
				}
			} );
			all( 'pause' ).forEach( ( el ) =>
				el.setAttribute( 'aria-pressed', String( slider.paused ) )
			);
			all( 'prev' ).forEach( ( el ) => {
				el.disabled = ! slider.canPrev;
			} );
			all( 'next' ).forEach( ( el ) => {
				el.disabled = ! slider.canNext;
			} );
		},

		destroy() {
			filled.forEach( ( el ) => el.replaceChildren() );
			[ ...all( 'prev' ), ...all( 'next' ) ].forEach( ( el ) => {
				el.disabled = false;
			} );
		},
	};
}
