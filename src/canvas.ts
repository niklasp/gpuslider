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

import type { Plugin, Slider } from './index.js';
import type { Effect } from './gl/program.js';

/** A slide as the canvas is about to draw it. What a hook changes is drawn. */
export interface Quad {
	/** Left edge in the view of the slider, px. */
	x: number;
	/** Top edge, px. */
	y: number;
	/** Width, px. */
	w: number;
	/** Height, px. */
	h: number;
	/**
	 * How far the slide is from its resting place, in slides: -1 is one
	 * before the active one.
	 */
	p: number;
	/** Radius of its corners, px. */
	radius: number;
	/** The exponent of its corners: 2 round, 4 a squircle. */
	shape: number;
	/**
	 * Added to the speed of the slider, for the effects: what moves fast
	 * stretches.
	 */
	speed: number;
	/** How much the effects do, 0 to 1. */
	fx: number;
	/** What its colour is multiplied by, 0 to 1. */
	dim: number;
	/** Whether it stays in the view of the slider. */
	clip: boolean;
	/** Whether it is drawn over the others. */
	top: boolean;
	/** What part of the picture is where; null: it is not drawn. */
	a: Float32Array | null;
	/** Another element whose picture it shows, once there is one. */
	media: HTMLElement | null;
}

/**
 * What `draw()` takes: is called with the index of every slide and its
 * quad, every frame.
 */
export type Hook = ( i: number, quad: Quad ) => void;

export interface Options {
	/** Effects, in the order they apply. */
	effects?: Effect[];
	/** Largest side of a texture, px. */
	maxSize?: number;
	/** Most device pixels per px drawn. */
	density?: number;
	/** Distance of the eye for meshes that bend, px. */
	perspective?: number;
	/** Make the canvas with the slider, not at the first sign of use. */
	eager?: boolean;
	/** Keep the drawing readable, for tests. */
	preserve?: boolean;
	/** That layer, whatever the browser has. */
	layer?: 'gpu' | 'gl';
}

/**
 * @param options Options.
 */
export function canvas( { layer, ...options }: Options = {} ) {
	// The plugin, for the `plugins` of a slider.
	return ( slider: Slider ) => {
		const { win, signal } = slider;
		const hooks = new Set< Hook >();
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
					( slider.use( made( { ...options, hooks } ) ) as Plugin ).name
				);
			}
		} );
		return {
			name: 'canvas',
			/**
			 * @param hook Called with every slide before it is drawn.
			 * @return Takes it away again.
			 */
			draw: ( hook: Hook ): ( () => void ) => (
				hooks.add( hook ),
				slider.wake(),
				() => hooks.delete( hook ) && slider.wake()
			),
		} satisfies Plugin;
	};
}
