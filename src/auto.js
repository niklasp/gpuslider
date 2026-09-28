/**
 * Sliders without a line of script of one's own: this file makes a slider
 * of every element with `data-ss` on the page.
 *
 *     <link rel="stylesheet" href="…/shaderslide/dist/style.css">
 *     <script type="module" src="…/shaderslide/dist/auto.js"></script>
 *
 *     <div class="ss" data-ss='{ "loop": true, "autoplay": 4000 }'
 *          data-ss-gl="stretch split">
 *         <div class="ss-track"> … </div>
 *     </div>
 *
 *     data-ss            the options of `shaderslide/full`, as JSON, or
 *                        nothing
 *     data-ss-gl         the canvas, with the effects that are named:
 *                        "stretch split", or with their options
 *                        '{ "stretch": { "amount": 2 } }'
 *     data-ss-lightbox   a lightbox, with effects as above
 *
 * The canvas and the lightbox are loaded when a slider asks for them, and
 * when the page has time: a page without them never loads them.
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
		const { ss, ssGl, ssLightbox } = /** @type {HTMLElement} */ ( root )
			.dataset;
		const slider = createSlider( root, ss ? JSON.parse( ss ) : {} );
		sliders.set( root, slider );
		slider.on( 'destroy', () => sliders.delete( root ) );

		if ( ssGl !== undefined || ssLightbox !== undefined ) {
			const win = root.ownerDocument.defaultView;
			( win.requestIdleCallback || win.setTimeout )( async () => {
				const canvas = await import( './gl/index.js' );
				const effects = ( text ) =>
					named( text ).flatMap( ( [ name, options ] ) =>
						canvas[ name ] ? [ canvas[ name ]( options ) ] : []
					);
				if ( slider.signal.aborted ) {
					return;
				}
				if ( ssGl !== undefined ) {
					slider.use( canvas.gl( { effects: effects( ssGl ) } ) );
				}
				if ( ssLightbox !== undefined ) {
					const { lightbox } = await import( './lightbox.js' );
					slider.use( lightbox( { effects: effects( ssLightbox ) } ) );
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
