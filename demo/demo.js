/**
 * The slider in a plain page: no build, no framework.
 */
import { createSlider } from '../src/full.js';
import { gl, stretch, split, waves, liquid } from '../src/gl/index.js';
import { lightbox } from '../src/lightbox.js';

const $ = ( id ) => document.getElementById( id );
const plugins = () => [
	gl( { effects: [ stretch(), split(), waves() ] } ),
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
		plugins: [ gl( { effects: [ split(), liquid() ] } ) ],
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
	const can = !! document.createElement( 'canvas' ).getContext( 'webgl2' );
	let lost = 0;
	const say = () => {
		const by = slider.plugins.gl?.canvas ? 'canvas' : 'page';
		line.textContent =
			`Drawn by the ${ by }` +
			( can ? '' : ' · this browser has no WebGL 2' ) +
			( lost ? ` · the browser took the canvas away ${ lost } times` : '' ) +
			` · ${ Math.abs( slider.view.velocity ).toFixed( 1 ) } views per second`;
	};
	slider.on( 'gl:on', say );
	slider.on( 'gl:off', ( gone ) => {
		lost += gone ? 1 : 0;
		say();
	} );
	slider.on( 'frame', say );
	say();
}
Object.values( window.sliders ).forEach( tell );
// The one that `auto.js` makes.
document.addEventListener( 'ss:ready', ( { detail } ) => tell( detail ) );
