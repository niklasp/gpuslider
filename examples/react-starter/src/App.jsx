import { Slider, Slide } from 'gpuslider/react';
import { controls, keyboard, autoplay, stack } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { liquid } from 'gpuslider/effects';
import 'gpuslider/style.css';

// Three things to try, one at a time. The preview reloads as you save.
//
// 1. Another transition. Change liquid to burn, here below and in the
//    import above: import { burn } from 'gpuslider/effects';
//    There are 24: liquid, ripple, glitch, burn, pixelate, swirl, lens,
//    fluted, warp, zoom, mosaic, blocks, fold, signal, push, chroma,
//    kaleido, displace, datamosh, wind, distance, glyphs, weave,
//    lightning.
//
// 2. More slides in view. Delete stack(), which lays the slides on top of
//    each other, and add perView={ 2.5 } and gap={ 12 } next to loop. The
//    slides now slide, and a transition has nothing to do: replace it
//    with stretch(), which stretches them as fast as they go.
//
// 3. Effects under the pointer. Add glass(), waves() or spotlight() to
//    the effects, and to the import, then move the pointer over the
//    slides. Any number of effects work together, in the order given.
//    The whole list is at https://gpuslider.com/docs/effects/
//
// Plugins are read when the slider is made: after a change, save, and the
// page reloads with the new slider.

// Pictures from picsum.photos, which sends the CORS header the canvas
// needs; with your own, keep crossOrigin or serve them from your origin.
const photos = [
	{ id: 1015, alt: 'A river between mountains' },
	{ id: 1039, alt: 'A waterfall in a forest' },
	{ id: 1043, alt: 'Leaves in autumn' },
	{ id: 1050, alt: 'A coast at dusk' },
];

export default function App() {
	return (
		<>
			<Slider
				id="photos"
				aria-label="Photos"
				loop
				duration={ 1400 }
				plugins={ [
					stack(),
					controls(),
					keyboard(),
					autoplay(),
					canvas( { effects: [ liquid() ] } ),
				] }
				around={
					<>
						<button data-gs-prev aria-label="Previous slide">‹</button>
						<button data-gs-next aria-label="Next slide">›</button>
					</>
				}
			>
				{ photos.map( ( { id, alt } ) => (
					<Slide key={ id }>
						<img
							className="gs-media"
							crossOrigin="anonymous"
							src={ `https://picsum.photos/id/${ id }/1600/1000` }
							alt={ alt }
						/>
					</Slide>
				) ) }
			</Slider>
			<p>
				Open <code>src/App.jsx</code>: three things to try, from another
				transition to effects under the pointer.
			</p>
		</>
	);
}
