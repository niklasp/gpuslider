import { createSlider } from '../src/index.js';

const $ = ( id ) => document.getElementById( id );

window.sliders = {
	one: createSlider( $( 'one' ), { loop: true } ),
	several: createSlider( $( 'several' ), { loop: true } ),
	auto: createSlider( $( 'auto' ), { perView: 'auto', align: 'center', loop: true } ),
	stack: createSlider( $( 'stack' ), { mode: 'stack', loop: true } ),
};

$( 'tier' ).textContent = 'Tier 2: the page draws the slides.';
