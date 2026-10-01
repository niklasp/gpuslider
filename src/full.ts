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
import type { Create, Options } from './index.js';
import type { Elements } from './plugins/elements.js';

export * from './plugins/index.js';

export type { Elements };

/** What the plugins take, as options of the slider. */
export interface More {
	/** Arrow keys, Home, End. On by default. */
	keyboard?: boolean;
	/** Sideways scrolling by trackpad or wheel. On by default. */
	wheel?: boolean;
	/** Time a slide stays, ms; 0 for no autoplay. */
	autoplay?: number;
	/** The slider is as high as the slides in view. */
	autoHeight?: boolean;
	/** Slides next to or on top of each other. */
	mode?: 'row' | 'stack';
	/** Buttons that go back, anywhere on the page. */
	prev?: Elements;
	/** Buttons that go on. */
	next?: Elements;
	/** Elements to fill with dots. */
	dots?: Elements;
	/** Buttons that stop autoplay. */
	pause?: Elements;
}

/**
 * @param root The slider element.
 * @param options Options.
 */
export function createSlider( root: HTMLElement, options: Options & More = {} ) {
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
		].filter( Boolean ) as Create[],
	} );
}
