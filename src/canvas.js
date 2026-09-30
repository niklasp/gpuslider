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
 *
 * `slider.plugins.canvas.draw( hook )` has a function of the page called
 * with every slide before it is drawn, with its index and its quad, from
 * the start on: to place the slides, or to move them, from a script.
 *
 *     slider.plugins.canvas.draw( ( i, quad ) => {
 *         quad.y += Math.sin( quad.p * Math.PI ) * 40;
 *     } );
 */

/**
 * @typedef {Object} Quad A slide as the canvas is about to draw it. What a
 *          hook changes is drawn.
 * @property {number}  x      Left edge in the view of the slider, px.
 * @property {number}  y      Top edge, px.
 * @property {number}  w      Width, px.
 * @property {number}  h      Height, px.
 * @property {number}  p      How far the slide is from its resting place, in
 *                            slides: -1 is one before the active one.
 * @property {number}  radius Radius of its corners, px.
 * @property {number}  speed  Added to the speed of the slider, for the
 *                            effects: what moves fast stretches.
 * @property {number}  fx     How much the effects do, 0 to 1.
 * @property {number}  dim    What its colour is multiplied by, 0 to 1.
 * @property {boolean} clip   Whether it stays in the view of the slider.
 * @property {boolean} top    Whether it is drawn over the others.
 * @property {Float32Array | null} a What part of the picture is where;
 *                            null: it is not drawn.
 * @property {HTMLElement | null} media Another element whose picture it
 *                            shows, once there is one.
 */

/**
 * @typedef {(i: number, quad: Quad) => void} Hook What `draw()` takes: is
 *          called with the index of every slide and its quad, every frame.
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
		/** @type {Set<Hook>} */
		const hooks = new Set();
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
				slider.emit(
					'canvas:ready',
					slider.use( made( { ...options, hooks } ) ).name
				);
			}
		} );
		return {
			name: 'canvas',
			/**
			 * @param {Hook} hook Called with every slide before it is drawn.
			 * @return {() => void} Takes it away again.
			 */
			draw: ( hook ) => (
				hooks.add( hook ),
				slider.wake(),
				() => hooks.delete( hook ) && slider.wake()
			),
		};
	};
}
