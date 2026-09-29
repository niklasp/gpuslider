/**
 * Sliders without a line of script of one's own: this file makes a slider
 * of every element with `data-ss` on the page.
 *
 *     <link rel="stylesheet" href="…/shaderslide/dist/style.css">
 *     <script type="module" src="…/shaderslide/dist/auto.js"></script>
 *
 *     <div class="ss" data-ss='{ "loop": true, "autoplay": 4000 }'
 *          data-ss-canvas="stretch split">
 *         <div class="ss-track"> … </div>
 *     </div>
 *
 *     data-ss            the options of `shaderslide/full`, as JSON, or
 *                        nothing
 *     data-ss-canvas     the canvas, with the effects that are named:
 *                        "stretch split", or with their options
 *                        '{ "stretch": { "amount": 2 } }'. Drawn by WebGPU
 *                        where the browser has it, by WebGL 2 where not
 *     data-ss-gpu        the same, by WebGPU or not at all
 *     data-ss-gl         the same, by WebGL 2 or not at all
 *     data-ss-lightbox   a lightbox, with effects as above
 *
 * The canvas and the lightbox are loaded when a slider asks for them, and
 * when the page has time: a page without them never loads them, and no
 * page loads the layer it does not draw with.
 *
 * An element tells when its slider is made: the event `ss:ready` has the
 * slider as its `detail` and goes up to the document. Later the slider is
 * `sliders.get( element )`.
 */
import { createSlider } from './full.js';

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
 * Makes sliders of the elements with `data-ss` that are not sliders yet.
 * Runs by itself when the page is read; for what comes later, call it.
 *
 * @param {Document | Element} [within] Where to look.
 */
export function auto( within = document ) {
	within.querySelectorAll( '[data-ss]' ).forEach( ( root ) => {
		if ( sliders.has( root ) ) {
			return;
		}
		const { ss, ssCanvas, ssGpu, ssGl, ssLightbox } =
			/** @type {HTMLElement} */ ( root ).dataset;
		const slider = createSlider( root, ss ? JSON.parse( ss ) : {} );
		sliders.set( root, slider );
		slider.on( 'destroy', () => sliders.delete( root ) );

		const drawn = ssCanvas ?? ssGpu ?? ssGl;
		if ( drawn !== undefined || ssLightbox !== undefined ) {
			const win = root.ownerDocument.defaultView;
			( win.requestIdleCallback || win.setTimeout )( async () => {
				// A browser may know WebGPU and have nothing to run it on.
				const can =
					ssGpu !== undefined ||
					( ssGl === undefined &&
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
				if ( drawn !== undefined ) {
					slider.use( layer( { effects: effects( drawn ) } ) );
				}
				if ( ssLightbox !== undefined ) {
					const { lightbox } = await import( './lightbox.js' );
					slider.use(
						lightbox( { effects: effects( ssLightbox ), layer } )
					);
				}
			} );
		}
		root.dispatchEvent(
			new CustomEvent( 'ss:ready', { detail: slider, bubbles: true } )
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
