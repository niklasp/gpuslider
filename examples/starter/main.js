import { createSlider } from 'gpuslider';
import { controls, keyboard, autoplay, stack } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { liquid } from 'gpuslider/effects';
import 'gpuslider/style.css';
import './style.css';

createSlider( document.getElementById( 'photos' ), {
	loop: true,
	duration: 1400,
	plugins: [ stack(), controls(), keyboard(), autoplay(), canvas( { effects: [ liquid() ] } ) ],
} );
