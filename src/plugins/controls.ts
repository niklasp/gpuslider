/**
 * Arrows and dots, wherever they are on the page.
 *
 * In the slider:
 *
 *     <button data-gs-prev>, <button data-gs-next>
 *     <div data-gs-dots>         filled with one button per snap
 *     <button data-gs-to="2">    goes to a snap
 *
 * Anywhere else, with the id of the slider on them or around them:
 *
 *     <nav data-gs-for="photos"><button data-gs-next>…</button></nav>
 *
 * Or handed over:
 *
 *     controls( { next: '.my-next', prev: element, dots: [ one, two ] } )
 *
 * Clicks are heard on the document, so controls that come later work too.
 */
import { elements } from './elements.js';
import type { Plugin, Slider } from '../index.js';
import type { Elements } from './elements.js';

export type { Elements };

/**
 * @param given Elements anywhere on the page.
 * @param given.prev Buttons that go back.
 * @param given.next Buttons that go on.
 * @param given.dots Elements to fill with dots.
 */
export function controls( given: { prev?: Elements; next?: Elements; dots?: Elements } = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const doc = slider.root.ownerDocument;
		const { mine, all } = elements( slider, given );
		const filled = new Set< HTMLElement >();

		doc.addEventListener(
			'click',
			( { target } ) => {
				if ( ! ( target as Element ).closest ) {
					return;
				}
				for ( const kind of [ 'prev', 'next' ] as const ) {
					if ( all( kind ).some( ( el ) => el.contains( target as Node ) ) ) {
						slider[ kind ]();
						return;
					}
				}
				const to = ( target as Element ).closest< HTMLElement >( '[data-gs-dot], [data-gs-to]' );
				if (
					to &&
					( to.dataset.gsTo
						? mine( to )
						: all( 'dots' ).some( ( el ) => el.contains( to ) ) )
				) {
					slider.to( Number( to.dataset.gsTo ?? to.dataset.gsDot ) );
				}
			},
			{ signal: slider.signal }
		);

		const mark = ( el: Element, on: boolean ) =>
			on
				? el.setAttribute( 'aria-current', 'true' )
				: el.removeAttribute( 'aria-current' );

		// After a change of the slide or of the layout.
		const update = () => {
			const count = slider.count();
			const { index } = slider;
			all( 'dots' ).forEach( ( el ) => {
				if ( el.children.length !== count || ! filled.has( el ) ) {
					filled.add( el );
					el.replaceChildren(
						...Array.from( { length: count }, ( _, i ) => {
							const dot = doc.createElement( 'button' );
							dot.type = 'button';
							dot.className = 'gs-dot';
							dot.dataset.gsDot = String( i );
							dot.setAttribute( 'aria-label', `${ i + 1 }` );
							return dot;
						} )
					);
					el.hidden = count < 2;
				}
				[ ...el.children ].forEach( ( dot, i ) => mark( dot, i === index ) );
			} );
			doc.querySelectorAll< HTMLElement >( '[data-gs-to]' ).forEach(
				( el ) =>
					mine( el ) && mark( el, Number( el.dataset.gsTo ) === index )
			);
			all( 'prev' ).forEach( ( el ) => {
				( el as HTMLButtonElement ).disabled = ! slider.canPrev;
			} );
			all( 'next' ).forEach( ( el ) => {
				( el as HTMLButtonElement ).disabled = ! slider.canNext;
			} );
		};
		slider.on( 'change', update );

		return {
			name: 'controls',
			/** Its buttons that go back or on, or where its dots are. */
			elements: all,
			measure: update,
			update,

			destroy() {
				filled.forEach( ( el ) => el.replaceChildren() );
				[ ...all( 'prev' ), ...all( 'next' ) ].forEach( ( el ) => {
					( el as HTMLButtonElement ).disabled = false;
				} );
			},
		} satisfies Plugin;
	};
}
