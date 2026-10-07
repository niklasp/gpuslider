/**
 * The canvas draws fewer pixels when frames come late, and stays so: a
 * phone or an old laptop, a browser that saves energy on battery and draws
 * thirty frames a second, many sliders on one page.
 *
 *     createSlider( element, { plugins: [ canvas( { effects } ), quality() ] } );
 *
 * While the slider moves, it measures the time between its frames. When
 * `frames` of them in a row are later than `late` ms, the canvas takes the
 * next of `steps`: its device pixels per px. It never goes back up, so
 * the picture does not change back and forth. On a battery that is low
 * and not charging, where the browser says so, it takes a step at once.
 *
 * Events of the slider: `quality:lower`, with the device pixels per px it
 * draws with now.
 */
import type { Plugin, Slider } from '../index.js';

/**
 * @param options Options.
 * @param options.late Time between frames that is late, ms.
 * @param options.frames Late frames in a row that make a step.
 * @param options.steps Device pixels per px, one after the
 *                      other.
 */
export function quality( { late = 25, frames = 3, steps = [ 1, 0.75 ] }: { late?: number; frames?: number; steps?: number[] } = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { win } = slider;
		let last = 0;
		let count = 0;
		let step = 0;

		const lower = () => {
			const layer = slider.plugins.gpu || slider.plugins.gl;
			// Only a step that draws fewer pixels than now.
			while (
				layer &&
				step < steps.length &&
				steps[ step ] >= Math.min( layer.density, win.devicePixelRatio || 1 )
			) {
				step++;
			}
			if ( layer && step < steps.length ) {
				layer.density = steps[ step++ ];
				slider.emit( 'quality:lower', layer.density );
				slider.wake();
			}
		};

		const off = slider.on( 'frame', () => {
			const now = win.performance.now();
			// Frames that follow each other: not the first of a move.
			if ( now - last < 200 ) {
				count = now - last > late ? count + 1 : 0;
				if ( count >= frames ) {
					count = 0;
					lower();
				}
			}
			last = now;
		} );

		( win.navigator as Navigator & { getBattery?: () => Promise< { charging: boolean; level: number } > } )
			.getBattery?.()
			.then( ( { charging, level } ) => {
				if ( ! charging && level < 0.2 ) {
					// When there is a layer to tell.
					slider.on( 'canvas:ready', lower );
					lower();
				}
			} )
			.catch( () => {} );

		return {
			name: 'quality',
			/** The device pixels per px the canvas has been lowered to; none: 0. */
			get density() {
				return step ? steps[ step - 1 ] : 0;
			},
			destroy: off,
		} satisfies Plugin;
	};
}
