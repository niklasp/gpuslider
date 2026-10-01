/**
 * The elements of the page that speak to a slider: buttons in it, buttons
 * anywhere with the id of the slider on them or around them
 *
 *     <nav data-gs-for="photos"><button data-gs-next>…</button></nav>
 *
 * and those that were handed over: an element, several, or a selector.
 */

import type { Slider } from '../index.js';

/** An element, several, or a selector. */
export type Elements = HTMLElement | HTMLElement[] | string;

/**
 * @param slider The slider.
 * @param given Elements that were handed
 *              over, by their kind.
 */
export function elements( slider: Slider, given: Record< string, Elements | undefined > ) {
	const { root } = slider;
	const doc = root.ownerDocument;

	// Whether an element of the page speaks to this slider.
	const mine = ( el: Element ) => {
		const to = el.closest< HTMLElement >( '[data-gs-for]' );
		return to
			? !! root.id && to.dataset.gsFor === root.id
			: // Not what belongs to a slider inside of this one.
			  root.contains( el ) && el.closest( '.gs' ) === root;
	};

	return {
		mine,
		/**
		 * @param kind `prev`, `next`, `dots`, `pause`.
		 * @return The elements of that kind.
		 */
		all: ( kind: string ): HTMLElement[] => [
			...new Set( [
				...[ ...doc.querySelectorAll< HTMLElement >( `[data-gs-${ kind }]` ) ].filter( mine ),
				...( typeof given[ kind ] === 'string'
					? doc.querySelectorAll< HTMLElement >( given[ kind ] )
					: ( [ given[ kind ] ].flat().filter( Boolean ) as HTMLElement[] ) ),
			] ),
		],
	};
}
