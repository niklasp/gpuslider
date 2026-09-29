import { type CSSProperties } from 'react';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import { Photos } from '@/components/Pieces';
import { controls, keyboard, marquee, wheel } from 'gpuslider/plugins';

/** A ticker, and photos with thumbnails. */
export default function Plugins() {
	return (
		<>
			<GpuSlider
				id="ticker"
				label="Ticker"
				options={ { loop: true, free: true } }
				className="cards"
				style={ { '--gs-per-view': 4.5, '--gs-gap': '16px' } as CSSProperties }
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
			</GpuSlider>
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
