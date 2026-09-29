import { useState } from 'react';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import { BUTTON } from '@/components/Frame';
import { controls, keyboard, videos, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { split, stretch, waves } from 'gpuslider/effects';

const BY = {
	best: 'The best there is',
	gpu: 'WebGPU',
	gl: 'WebGL 2',
	page: 'The page',
} as const;

type By = keyof typeof BY;

/** The same slider, drawn by who is chosen. */
export default function Canvas() {
	const [ by, setBy ] = useState< By >( 'best' );
	return (
		<>
			<div role="group" aria-label="Drawn by" className="flex flex-wrap gap-2">
				{ ( Object.keys( BY ) as By[] ).map( ( one ) => (
					<button
						key={ one }
						type="button"
						className={ BUTTON }
						aria-current={ one === by ? 'true' : undefined }
						onClick={ () => setBy( one ) }
					>
						{ BY[ one ] }
					</button>
				) ) }
			</div>
			<GpuSlider
				id="drawn"
				label="Drawn by what is chosen"
				options={ { loop: true } }
				made={ by }
				measured=""
				plugins={ () => [
					controls(),
					keyboard(),
					wheel(),
					videos(),
					...( by === 'page'
						? []
						: [
								canvas( {
									effects: [ stretch(), split(), waves() ],
									layer: by === 'best' ? undefined : by,
									// Here it is what is to be seen.
									eager: true,
								} ),
						  ] ),
				] }
			>
				<Slide image={ 1 } alt="Warm colour field" className="hero" sizes="70vw" />
				<Slide video="a" alt="Moving colour field" className="hero" sizes="70vw" />
				<Slide image={ 2 } alt="Blue colour field" className="hero" sizes="70vw" />
				<Slide image={ 4 } alt="Pink colour field" className="hero" sizes="70vw" />
			</GpuSlider>
			<p className="note">
				Under the slider: who draws it, what saying what is to be drawn
				costs the script, and the time from one frame to the next while it
				moves. A layer that the browser does not have leaves the slider to
				the page.
			</p>
		</>
	);
}
