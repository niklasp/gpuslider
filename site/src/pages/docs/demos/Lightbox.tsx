import { type CSSProperties } from 'react';
import 'gpuslider/lightbox.css';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import { controls, keyboard, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { split, stretch } from 'gpuslider/effects';
import { lightbox } from 'gpuslider/lightbox';

/** Click a slide. */
export default function Lightbox() {
	return (
		<>
			<GpuSlider
				id="opens"
				label="Photos that open"
				options={ { loop: true } }
				className="cards"
				style={ { '--gs-per-view': 3, '--gs-gap': '16px' } as CSSProperties }
				made=""
				measured=""
				plugins={ () => [
					controls(),
					keyboard(),
					wheel(),
					canvas( { effects: [ stretch(), split() ] } ),
					lightbox( { effects: [ stretch(), split() ] } ),
				] }
			>
				{ [ 3, 5, 7, 1, 8, 2 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="card"
						sizes="(max-width: 640px) 77vw, 30vw"
					/>
				) ) }
			</GpuSlider>
			<p className="note">
				Click a slide. In the lightbox: drag, the arrows, the keys, and
				Escape to let the image go back into its slide.
			</p>
		</>
	);
}
