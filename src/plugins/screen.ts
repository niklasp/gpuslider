/**
 * Whether a slider is on the screen: for what should only happen where
 * somebody can see it.
 */

import type { Slider } from '../index.js';

/**
 * @param slider The slider.
 * @param tell Called when it changes. Until
 *             the browser says otherwise,
 *             the slider is off the screen:
 *             a video or a timer far down the
 *             page does not start for a frame.
 * @return Stops watching.
 */
export function onScreen( slider: Slider, tell: (on: boolean) => void ): () => void {
	let is = false;
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
