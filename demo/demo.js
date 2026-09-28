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
