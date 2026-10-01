/**
 * A slider of thumbnails for another slider: its slides are buttons that
 * take the other one to their slide, and the one that is shown there is
 * marked and in view here.
 *
 *     const photos = createSlider( one, { … } );
 *     createSlider( two, { plugins: [ thumbs( photos ) ] } );
 *
 * The thumbnail of the slide that is shown has the class `gs-active` and
 * `aria-current`. A thumbnail is named by the text of its picture (`alt`),
 * or by its number.
 */

import type { Plugin, Slider } from '../index.js';

/**
 * @param of The slider they are the
 *           thumbnails of: one per snap.
 */
export function thumbs( of: Slider ) {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { slides, root, signal } = slider;

		const mark = () => {
			slides.forEach( ( slide, i ) => {
				const on = i === of.index;
				slide.classList.toggle( 'gs-active', on );
				if ( on ) {
					slide.setAttribute( 'aria-current', 'true' );
				} else {
					slide.removeAttribute( 'aria-current' );
				}
			} );
			slider.toSlide( of.index );
		};
		const dress = () =>
			slides.forEach( ( slide, i ) => {
				slide.setAttribute( 'role', 'button' );
				slide.removeAttribute( 'aria-roledescription' );
				slide.setAttribute(
					'aria-label',
					slide.querySelector( 'img' )?.alt || `${ i + 1 }`
				);
				slide.tabIndex = 0;
			} );
		dress();

		const off = of.on( 'change', mark );
		slider.on( 'click', ( { index } ) => of.to( index ) );
		root.addEventListener(
			'keydown',
			( event ) => {
				const at = slides.indexOf( event.target as HTMLElement );
				if ( at >= 0 && ( event.key === 'Enter' || event.key === ' ' ) ) {
					event.preventDefault();
					of.to( at );
				}
			},
			{ signal }
		);

		// The slider is measured before it goes anywhere.
		let first = true;
		return {
			name: 'thumbs',
			slides: dress,

			measure() {
				if ( first ) {
					first = false;
					slider.win.queueMicrotask( mark );
				}
			},

			destroy() {
				off();
				slides.forEach( ( slide ) => {
					slide.classList.remove( 'gs-active' );
					slide.removeAttribute( 'aria-current' );
					slide.removeAttribute( 'tabindex' );
				} );
			},
		} satisfies Plugin;
	};
}
