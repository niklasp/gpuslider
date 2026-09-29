import { type CSSProperties } from 'react';
import 'shaderslide/lightbox.css';
import { ShaderSlider, Slide } from '@/components/ShaderSlider';
import { controls, keyboard, wheel } from 'shaderslide/plugins';
import { canvas } from 'shaderslide/canvas';
import { split, stretch } from 'shaderslide/effects';
import { lightbox } from 'shaderslide/lightbox';

/** Click a slide. */
export default function Lightbox() {
	return (
		<>
			<ShaderSlider
				id="opens"
				label="Photos that open"
				options={ { loop: true } }
				className="cards"
				style={ { '--ss-per-view': 3, '--ss-gap': '16px' } as CSSProperties }
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
			</ShaderSlider>
			<p className="note">
				Click a slide. In the lightbox: drag, the arrows, the keys, and
				Escape to let the image go back into its slide.
			</p>
		</>
	);
}
