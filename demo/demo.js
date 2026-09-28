import { createSlider } from '../src/index.js';
import * as canvas from '../src/gl/index.js';
import * as transitions from '../src/gl/transitions/index.js';

const $ = ( id ) => document.getElementById( id );
const form = $( 'settings' );

// What the address says: ?effects=stretch,bend&transition=liquid&canvas=0
const query = new URLSearchParams( location.search );
if ( query.has( 'effects' ) ) {
	const chosen = query.get( 'effects' ).split( ',' );
	form.querySelectorAll( '[name=effect]' ).forEach( ( box ) => {
		box.checked = chosen.includes( box.value );
	} );
}
form.elements.canvas.checked = query.get( 'canvas' ) !== '0';
form.elements.transition.append(
	...Object.keys( transitions ).map( ( name ) => new Option( name, name ) )
);
form.elements.transition.value = query.get( 'transition' ) || 'liquid';

const SLIDERS = {
	one: { loop: true },
	several: { loop: true },
	auto: { perView: 'auto', align: 'center', loop: true },
	stack: { mode: 'stack', loop: true, duration: 1100 },
};

window.sliders = {};

function build() {
	const data = new FormData( form );
	const effects = () =>
		data.getAll( 'effect' ).map( ( name ) => canvas[ name ]() );
	for ( const [ id, options ] of Object.entries( SLIDERS ) ) {
		const at = window.sliders[ id ]?.index || 0;
		window.sliders[ id ]?.destroy();
		const stack = options.mode === 'stack';
		window.sliders[ id ] = createSlider( $( id ), {
			...options,
			start: at,
			layers: data.has( 'canvas' )
				? [
						canvas.gl( {
							effects: stack
								? [
										// A row bends, a stack does not.
										...effects().filter( ( e ) => ! e.vertex ),
										canvas[ data.get( 'transition' ) ](),
								  ]
								: effects(),
						} ),
				  ]
				: [],
		} );
	}
	const drawing = Object.values( window.sliders ).some(
		( slider ) => slider.layers.length
	);
	$( 'tier' ).textContent = drawing
		? 'The canvas draws the media.'
		: 'The page draws the media.';
}

form.addEventListener( 'change', build );
build();
