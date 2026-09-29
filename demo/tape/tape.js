/**
 * Tape: four tickers that run against each other. The page that is
 * scrolled pushes them, and what is pushed stretches.
 *
 * The screen while the pictures load is the one the library makes, one in
 * every row, and they count together.
 */
import { createSlider } from '../../src/index.js';
import { loading, marquee } from '../../src/plugins/index.js';
import { canvas } from '../../src/canvas.js';
import { stretch, split, jelly } from '../../src/effects.js';

// `?layer=gl` and `?layer=gpu` say who draws.
const layer = new URLSearchParams( location.search ).get( 'layer' );
const said = document.getElementById( 'said' );
const together = loading( { min: 600 } );

window.tapes = [ ...document.querySelectorAll( '.tape' ) ].map( ( root ) =>
	createSlider( root, {
		loop: true,
		free: true,
		plugins: [
			together,
			marquee( {
				speed: 46 * Number( root.dataset.way ),
				hover: 0.25,
				scroll: 0.7,
			} ),
			canvas( {
				effects: [ jelly( { amount: 0.7 } ), stretch(), split() ],
				layer,
			} ),
		],
		on: {
			'canvas:ready': ( name ) => {
				said.textContent = `Scroll · drawn by ${
					name === 'gpu' ? 'WebGPU' : 'WebGL'
				}`;
			},
		},
	} )
);
