/**
 * The slider with everything: the core and all of `plugins/`, by options.
 *
 *     import { createSlider } from 'gpuslider/full';
 *
 *     createSlider( element, { loop: true, autoplay: 3500 } );
 *
 * Arrows, dots, keys, the wheel and the care for videos are there without
 * asking. Who wants less takes the core and the plugins of their choice.
 */
import { createSlider as create } from './index.js';
import {
	controls,
	keyboard,
	wheel,
	autoplay,
	videos,
	autoHeight,
	stack,
} from './plugins/index.js';

export * from './plugins/index.js';

/**
 * @typedef {import('./plugins/elements.js').Elements} Elements
 */

/**
 * @typedef {Object} More What the plugins take, as options of the slider.
 * @property {boolean}  [keyboard]   Arrow keys, Home, End. On by default.
 * @property {boolean}  [wheel]      Sideways scrolling by trackpad or wheel.
 *                                   On by default.
 * @property {number}   [autoplay]   Time a slide stays, ms; 0 for no
 *                                   autoplay.
 * @property {boolean}  [autoHeight] The slider is as high as the slides in
 *                                   view.
 * @property {'row'|'stack'} [mode]  Slides next to or on top of each other.
 * @property {Elements} [prev]       Buttons that go back, anywhere on the
 *                                   page.
 * @property {Elements} [next]       Buttons that go on.
 * @property {Elements} [dots]       Elements to fill with dots.
 * @property {Elements} [pause]      Buttons that stop autoplay.
 */

/**
 * @param {HTMLElement}                           root      The slider element.
 * @param {import('./index.js').Options & More} [options] Options.
 */
export function createSlider( root, options = {} ) {
	const {
		keyboard: keys = true,
		wheel: rolls = true,
		autoplay: delay = 0,
		autoHeight: tall = false,
		mode,
		prev,
		next,
		dots,
		pause,
		plugins = [],
		...rest
	} = options;
	return create( root, {
		...rest,
		plugins: [
			mode === 'stack' && stack(),
			controls( { prev, next, dots } ),
			keys && keyboard(),
			rolls && wheel(),
			videos(),
			delay > 0 && autoplay( { delay, pause } ),
			tall && autoHeight(),
			...plugins,
		].filter( Boolean ),
	} );
}
