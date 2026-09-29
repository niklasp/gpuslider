/**
 * A reel: a stack whose pictures turn into each other, and a screen before
 * it that is made of the events of `loading()` and of nothing else.
 */
import { createSlider } from '../../src/full.js';
import { loading } from '../../src/plugins/index.js';
import { canvas } from '../../src/canvas.js';
import { split, waves, warp } from '../../src/effects.js';

const intro = document.getElementById( 'intro' );
const count = document.getElementById( 'count' );
const what = document.getElementById( 'what' );
const said = document.getElementById( 'said' );
// `?layer=gl` and `?layer=gpu` say who draws.
const layer = new URLSearchParams( location.search ).get( 'layer' );

// The number on the screen runs after the one that is told.
let told = 0;
let shown = 0;
let over = null;
function run() {
	shown += ( told - shown ) * 0.12;
	if ( told - shown < 0.4 ) {
		shown = told;
	}
	count.textContent = Math.round( shown );
	intro.setAttribute( 'aria-valuenow', Math.round( shown ) );
	if ( shown < told || ! over ) {
		requestAnimationFrame( run );
		return;
	}
	// All is there, and the number has said so.
	intro.classList.add( 'gone' );
	over();
}
requestAnimationFrame( run );

const mark = ( slider ) =>
	slider.slides.forEach( ( slide, i ) =>
		slide.classList.toggle( 'shown', i === slider.index )
	);

const reel = createSlider( document.getElementById( 'reel' ), {
	mode: 'stack',
	loop: true,
	duration: 1500,
	autoplay: 5000,
	plugins: [
		loading( { screen: false } ),
		canvas( {
			effects: [ split(), waves( { amount: 0.6 } ), warp() ],
			eager: true,
			layer,
		} ),
	],
	on: {
		'loading:start': ( { total } ) => {
			what.textContent = `${ total } pictures and films`;
		},
		'loading:progress': ( { progress, failed } ) => {
			told = progress * 100;
			if ( failed ) {
				what.textContent = `${ failed } of them did not come`;
			}
		},
		'loading:done': ( { late } ) => {
			told = 100;
			if ( late ) {
				what.textContent = 'Not all of them came in time';
			}
			// The first words come when the curtain is up.
			over = () => mark( reel );
		},
		'canvas:ready': ( name ) => {
			said.textContent = `Arrows, keys, a drag · drawn by ${
				name === 'gpu' ? 'WebGPU' : 'WebGL'
			}`;
		},
		change: () => over && mark( reel ),
	},
} );
// It waits for the curtain.
reel.plugins.autoplay.pause();
reel.plugins.loading.ready.then( () => reel.plugins.autoplay.play() );

window.reel = reel;
