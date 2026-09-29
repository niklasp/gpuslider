/**
 * Sliders without a line of script of one's own: this file makes a slider
 * of every element with `data-gs` on the page.
 *
 *     <link rel="stylesheet" href="…/gpuslider/dist/style.css">
 *     <script type="module" src="…/gpuslider/dist/auto.js"></script>
 *
 *     <div class="gs" data-gs='{ "loop": true, "autoplay": 4000 }'
 *          data-gs-canvas="stretch split">
 *         <div class="gs-track"> … </div>
 *     </div>
 *
 *     data-gs            the options of `gpuslider/full`, as JSON, or
 *                        nothing
 *     data-gs-canvas     the canvas, with the effects that are named:
 *                        "stretch split", or with their options
 *                        '{ "stretch": { "amount": 2 } }'. Drawn by WebGPU
 *                        where the browser has it, by WebGL 2 where not
 *     data-gs-gpu        the same, by WebGPU or not at all
 *     data-gs-gl         the same, by WebGL 2 or not at all
 *     data-gs-lightbox   a lightbox, drawn by the canvas of the slider
 *     data-gs-loading    a screen while the media load; its options as
 *                        JSON, or nothing. Needs `loading.css`
 *
 * The canvas and the lightbox are loaded when a slider asks for them, and
 * when the page has time: a page without them never loads them, and no
 * page loads the layer it does not draw with.
 *
 * An element tells when its slider is made: the event `gs:ready` has the
 * slider as its `detail` and goes up to the document. Later the slider is
 * `sliders.get( element )`.
 */
import { createSlider } from './full.js';
import { loading } from './plugins/loading.js';

/**
 * The sliders that were made here, by their element.
 *
 * @type {WeakMap<Element, import('./index.js').Slider>}
 */
export const sliders = new WeakMap();

// 'a b' or '{ "a": { … } }' as [ name, options ] pairs.
const named = ( text ) =>
	/^\s*\{/.test( text )
		? Object.entries( JSON.parse( text ) )
		: text.split( /[\s,]+/ ).filter( Boolean ).map( ( name ) => [ name ] );

/**
 * Makes sliders of the elements with `data-gs` that are not sliders yet.
 * Runs by itself when the page is read; for what comes later, call it.
 *
 * @param {Document | Element} [within] Where to look.
 */
export function auto( within = document ) {
	within.querySelectorAll( '[data-gs]' ).forEach( ( root ) => {
		if ( sliders.has( root ) ) {
			return;
		}
		const { gs, gsCanvas, gsGpu, gsGl, gsLightbox, gsLoading } =
			/** @type {HTMLElement} */ ( root ).dataset;
		const slider = createSlider( root, {
			...( gs ? JSON.parse( gs ) : {} ),
			plugins:
				gsLoading !== undefined
					? [ loading( gsLoading ? JSON.parse( gsLoading ) : {} ) ]
					: [],
		} );
		sliders.set( root, slider );
		slider.on( 'destroy', () => sliders.delete( root ) );

		const drawn = gsCanvas ?? gsGpu ?? gsGl;
		if ( drawn !== undefined || gsLightbox !== undefined ) {
			const win = root.ownerDocument.defaultView;
			( win.requestIdleCallback || win.setTimeout )( async () => {
				// A browser may know WebGPU and have nothing to run it on.
				const can =
					gsGpu !== undefined ||
					( gsGl === undefined &&
						( await win.navigator.gpu
							?.requestAdapter()
							.catch( () => null ) ) );
				const canvas = can
					? await import( './gpu/index.js' )
					: await import( './gl/index.js' );
				const effects = ( text ) =>
					named( text ).flatMap( ( [ name, options ] ) =>
						canvas[ name ] ? [ canvas[ name ]( options ) ] : []
					);
				if ( slider.signal.aborted ) {
					return;
				}
				const layer = canvas.gpu || canvas.gl;
				// A lightbox is drawn by the canvas of the slider.
				slider.use( layer( { effects: effects( drawn || '' ) } ) );
				if ( gsLightbox !== undefined ) {
					const { lightbox } = await import( './lightbox.js' );
					slider.use( lightbox() );
				}
			} );
		}
		root.dispatchEvent(
			new CustomEvent( 'gs:ready', { detail: slider, bubbles: true } )
		);
	} );
}

if ( typeof document !== 'undefined' ) {
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', () => auto() );
	} else {
		auto();
	}
}
