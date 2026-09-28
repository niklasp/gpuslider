/**
 * The elements of the page that speak to a slider: buttons in it, buttons
 * anywhere with the id of the slider on them or around them
 *
 *     <nav data-ss-for="photos"><button data-ss-next>…</button></nav>
 *
 * and those that were handed over: an element, several, or a selector.
 */

/**
 * @typedef {HTMLElement | HTMLElement[] | string} Elements An element,
 *          several, or a selector.
 */

/**
 * @param {import('../index.js').Slider} slider The slider.
 * @param {Record<string, Elements>}     given  Elements that were handed
 *                                              over, by their kind.
 */
export function elements( slider, given ) {
	const { root } = slider;
	const doc = root.ownerDocument;

	// Whether an element of the page speaks to this slider.
	const mine = ( el ) => {
		const to = el.closest( '[data-ss-for]' );
		return to
			? !! root.id && to.dataset.ssFor === root.id
			: // Not what belongs to a slider inside of this one.
			  root.contains( el ) && el.closest( '.ss' ) === root;
	};

	return {
		mine,
		/**
		 * @param {string} kind `prev`, `next`, `dots`, `pause`.
		 * @return {HTMLElement[]} The elements of that kind.
		 */
		all: ( kind ) => [
			...new Set( [
				...[ ...doc.querySelectorAll( `[data-ss-${ kind }]` ) ].filter( mine ),
				...( typeof given[ kind ] === 'string'
					? doc.querySelectorAll( given[ kind ] )
					: [ given[ kind ] ].flat().filter( Boolean ) ),
			] ),
		],
	};
}
