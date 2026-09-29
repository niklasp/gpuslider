import { type CSSProperties } from 'react';
import { ShaderSlider, Slide } from '@/components/ShaderSlider';
import { Photos } from '@/components/Pieces';
import { controls, keyboard, marquee, wheel } from 'shaderslide/plugins';

/** A ticker, and photos with thumbnails. */
export default function Plugins() {
	return (
		<>
			<ShaderSlider
				id="ticker"
				label="Ticker"
				options={ { loop: true, free: true } }
				className="cards"
				style={ { '--ss-per-view': 4.5, '--ss-gap': '16px' } as CSSProperties }
				made=""
				measured=""
				plugins={ () => [ marquee( { speed: 50, hover: 0.2, scroll: 0.4 } ) ] }
				bare
			>
				{ [ 8, 6, 4, 2, 7, 5, 3, 1 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="card"
						sizes="(max-width: 640px) 77vw, 22vw"
					/>
				) ) }
			</ShaderSlider>
			<p className="note">
				<code>marquee()</code>: it runs by itself, slower under the pointer
				and faster while the page is scrolled. Drag it, and it runs on.
			</p>
			<Photos
				options={ { loop: true } }
				made=""
				measured=""
				plugins={ () => [ controls(), keyboard(), wheel() ] }
			/>
			<p className="note">
				<code>thumbs()</code>: two sliders, and the slides of the small one
				are the buttons of the large one.
			</p>
		</>
	);
}
