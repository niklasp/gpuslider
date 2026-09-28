/**
 * Arrow keys, Home and End, while the focus is in the slider. The slider
 * itself can have the focus. A slider that goes down takes the arrows up
 * and down.
 */

const TYPING = 'input, textarea, select, [contenteditable]';

export function keyboard() {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root } = slider;
		const had = root.hasAttribute( 'tabindex' );
		if ( ! had ) {
			root.tabIndex = 0;
		}

		root.addEventListener(
			'keydown',
			( event ) => {
				if (
					event.defaultPrevented ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					event.target.closest( TYPING )
				) {
					return;
				}
				const { rtl, y } = slider.layout();
				const act = {
					[ y ? 'ArrowDown' : 'ArrowRight' ]: rtl ? slider.prev : slider.next,
					[ y ? 'ArrowUp' : 'ArrowLeft' ]: rtl ? slider.next : slider.prev,
					Home: () => slider.to( 0 ),
					End: () => slider.to( slider.count() - 1 ),
				}[ event.key ];
				if ( act ) {
					act();
					event.preventDefault();
				}
			},
			{ signal: slider.signal }
		);

		return {
			name: 'keyboard',
			destroy() {
				if ( ! had ) {
					root.removeAttribute( 'tabindex' );
				}
			},
		};
	};
}
