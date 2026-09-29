/**
 * The slider in a plain page: no build, no framework.
 */
import { createSlider } from '../src/full.js';
import { canvas } from '../src/canvas.js';
import { stretch, split, waves, liquid } from '../src/effects.js';
import { lightbox } from '../src/lightbox.js';

const $ = ( id ) => document.getElementById( id );
// WebGPU where the browser has it, WebGL where not. `?layer=gl` and
// `?layer=gpu` say which, to see the one beside the other.
const layer = new URLSearchParams( location.search ).get( 'layer' );
const plugins = () => [
	canvas( { effects: [ stretch(), split(), waves() ], layer } ),
	lightbox( { effects: [ stretch() ] } ),
];

window.sliders = {
	one: createSlider( $( 'one' ), { loop: true, plugins: plugins() } ),
	several: createSlider( $( 'several' ), { loop: true, plugins: plugins() } ),
	auto: createSlider( $( 'auto' ), {
		perView: 'auto',
		align: 'center',
		loop: true,
		plugins: plugins(),
	} ),
	tall: createSlider( $( 'tall' ), {
		autoHeight: true,
		loop: true,
		plugins: plugins(),
	} ),
	stack: createSlider( $( 'stack' ), {
		mode: 'stack',
		loop: true,
		duration: 1100,
		autoplay: 3500,
		plugins: [ canvas( { effects: [ split(), liquid() ], layer } ) ],
	} ),
};

/**
 * Under every slider: who draws it, and how fast it moves. A slider at
 * rest is drawn by the page until somebody comes.
 *
 * @param {import('../src/index.js').Slider} slider Slider.
 */
function tell( slider ) {
	const line = document.createElement( 'p' );
	line.className = 'state';
	slider.root.after( line );
	const can =
		!! navigator.gpu ||
		!! document.createElement( 'canvas' ).getContext( 'webgl2' );
	let lost = 0;
	const say = () => {
		const { gpu, gl } = slider.plugins;
		const by = ! ( gpu || gl )?.canvas
			? 'the page'
			: gpu
			? 'WebGPU'
			: 'WebGL';
		line.textContent =
			`Drawn by ${ by }` +
			( can ? '' : ' · this browser has neither WebGPU nor WebGL 2' ) +
			( lost ? ` · the browser took the canvas away ${ lost } times` : '' ) +
			` · ${ Math.abs( slider.view.velocity ).toFixed( 1 ) } views per second`;
	};
	[ 'gpu', 'gl' ].forEach( ( name ) => {
		slider.on( `${ name }:on`, say );
		slider.on( `${ name }:off`, ( gone ) => {
			lost += gone ? 1 : 0;
			say();
		} );
	} );
	slider.on( 'frame', say );
	say();
}
Object.values( window.sliders ).forEach( tell );
// The one that `auto.js` makes.
document.addEventListener( 'ss:ready', ( { detail } ) => tell( detail ) );
