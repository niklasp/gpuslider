import { createSlider } from 'gpuslider';
import { controls, keyboard, autoplay, stack } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { liquid } from 'gpuslider/effects';
import 'gpuslider/style.css';
import './style.css';

// Three things to try, one at a time. The preview reloads as you save.
//
// 1. Another transition. Change liquid to burn, here below and in the
//    import above: import { burn } from 'gpuslider/effects';
//    There are 21: liquid, ripple, glitch, burn, pixelate, swirl, lens,
//    fluted, warp, zoom, mosaic, blocks, fold, signal, push, chroma,
//    kaleido, displace, datamosh, wind, distance.
//
// 2. More slides in view. Delete stack(), which lays the slides on top of
//    each other, and add perView: 2.5 and gap: 12 next to loop. The
//    slides now slide, and a transition has nothing to do: replace it
//    with stretch(), which stretches them as fast as they go.
//
// 3. Effects under the pointer. Add glass(), waves() or spotlight() to
//    the effects, and to the import, then move the pointer over the
//    slides. Any number of effects work together, in the order given.
//    The whole list is at https://gpuslider.com/docs/effects/

createSlider( document.getElementById( 'photos' ), {
	loop: true,
	duration: 1400,
	plugins: [
		stack(),
		controls(),
		keyboard(),
		autoplay(),
		canvas( { effects: [ liquid() ] } ),
	],
} );
