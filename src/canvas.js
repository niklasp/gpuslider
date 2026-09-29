/**
 * The canvas layer that the browser can draw: WebGPU where it has it,
 * WebGL 2 where not. The page loads the one it uses, and that one only,
 * when it has time.
 *
 *     import { canvas } from 'gpuslider/canvas';
 *     import { stretch } from 'gpuslider/effects';
 *
 *     createSlider( element, { plugins: [ canvas( { effects: [ stretch() ] } ) ] } );
 *
 * The layer is `slider.plugins.gpu` or `slider.plugins.gl` once it is
 * there, and tells so: `canvas:ready`, with its name.
 */

/**
 * @typedef {Object} Options
 * @property {import('./gl/program.js').Effect[]} [effects] Effects, in the
 *           order they apply.
 * @property {number}       [maxSize]     Largest side of a texture, px.
 * @property {number}       [density]     Most device pixels per px drawn.
 * @property {number}       [perspective] Distance of the eye for meshes
 *           that bend, px.
 * @property {boolean}      [eager]       Make the canvas with the slider,
 *           not at the first sign of use.
 * @property {boolean}      [preserve]    Keep the drawing readable, for
 *           tests.
 * @property {'gpu' | 'gl'} [layer]       That layer, whatever the browser
 *           has.
 */

/**
 * @param {Options} [options] Options.
 */
export function canvas( { layer, ...options } = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('./index.js').Slider} */ slider ) => {
		const { win, signal } = slider;
		( win.requestIdleCallback || win.setTimeout )( async () => {
			// A browser may know WebGPU and have nothing to run it on.
			const can =
				layer !== 'gl' &&
				( await win.navigator.gpu?.requestAdapter().catch( () => null ) );
			const made =
				can || layer === 'gpu'
					? ( await import( './gpu/layer.js' ) ).gpu
					: ( await import( './gl/layer.js' ) ).gl;
			// Effects that lay the slides out: a click finds what is seen.
			const seen =
				options.effects?.some( ( effect ) => effect.place ) &&
				( await import( './hit.js' ) ).hit;
			if ( ! signal.aborted ) {
				if ( seen ) {
					slider.use( seen( options ) );
				}
				slider.emit( 'canvas:ready', slider.use( made( options ) ).name );
			}
		} );
		return { name: 'canvas' };
	};
}
