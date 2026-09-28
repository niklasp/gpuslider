/**
 * The slider in a plain page: no build, no framework.
 */
import { createSlider } from '../src/index.js';
import { gl, stretch, split, liquid } from '../src/gl/index.js';
import { lightbox } from '../src/lightbox.js';

const $ = ( id ) => document.getElementById( id );
const layers = () => [
	gl( { effects: [ stretch(), split() ] } ),
	lightbox( { effects: [ stretch() ] } ),
];

window.sliders = {
	one: createSlider( $( 'one' ), { loop: true, layers: layers() } ),
	several: createSlider( $( 'several' ), { loop: true, layers: layers() } ),
	auto: createSlider( $( 'auto' ), {
		perView: 'auto',
		align: 'center',
		loop: true,
		layers: layers(),
	} ),
	tall: createSlider( $( 'tall' ), {
		autoHeight: true,
		loop: true,
		layers: layers(),
	} ),
	stack: createSlider( $( 'stack' ), {
		mode: 'stack',
		loop: true,
		duration: 1100,
		autoplay: 3500,
		layers: [ gl( { effects: [ split(), liquid() ] } ) ],
	} ),
};
