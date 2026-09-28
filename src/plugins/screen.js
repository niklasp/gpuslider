/**
 * Whether a slider is on the screen: for what should only happen where
 * somebody can see it.
 */

/**
 * @param {import('../index.js').Slider} slider The slider.
 * @param {(on: boolean) => void}        tell   Called when it changes. Until
 *                                              the browser says otherwise,
 *                                              the slider is on the screen.
 * @return {() => void} Stops watching.
 */
export function onScreen( slider, tell ) {
	let is = true;
	const observer = new slider.win.IntersectionObserver( ( entries ) => {
		const on = entries[ entries.length - 1 ].isIntersecting;
		if ( on !== is ) {
			is = on;
			tell( on );
		}
	} );
	observer.observe( slider.root );
	return () => observer.disconnect();
}
