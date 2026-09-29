import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import './wave.css';
import { createSlider } from 'gpuslider';
import { keyboard, loading, marquee, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { dome, split, wave } from 'gpuslider/effects';
import pictures from '@/lib/wall.json';
import { pinned } from '@/lib/media';
import { drawnBy, layer } from '../mount';

/**
 * Wave: a band of pictures that runs across the screen along a wave,
 * larger in the middle. After the experimental carousels of Colin
 * Demouge.
 */
export default function Wave() {
	const root = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const slider = createSlider( root.current!, {
			loop: true,
			free: true,
			plugins: [
				loading( { min: 500 } ),
				marquee( { speed: -60, hover: 0.4 } ),
				wheel(),
				keyboard(),
				canvas( {
					effects: [
						wave( { height: 0.1, length: 1.1, slope: -0.32 } ),
						dome( { amount: 0.55 } ),
						split( { amount: 1.5 } ),
					],
					layer: layer(),
				} ),
			],
			on: {
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
			},
		} );
		Object.assign( window, { slider } );
		return () => slider.destroy();
	}, [] );

	return (
		<>
			<header>
				<a href="/examples/">gpu slider</a>
				<span>Wave{ by && ` · drawn by ${ by }` }</span>
			</header>
			<div ref={ root } className="gs band" aria-label="Pictures along a wave">
				<div className="gs-track">
					{ pictures.map( ( { title, line }, n ) => (
						<div className="gs-slide" key={ title }>
							<img
								className="gs-media"
								{ ...pinned( n, 'clamp(150px, 17vw, 260px)' ) }
								alt={ `${ title }. ${ line }` }
								draggable={ false }
							/>
						</div>
					) ) }
				</div>
			</div>
			<footer>
				<p>
					Drag it, or turn the wheel. The slides are in a row as ever; the
					canvas draws them along a wave, <code>wave()</code>, and smaller
					away from the middle, <code>dome()</code>.
				</p>
				<p>
					After the{ ' ' }
					<a href="https://tympanus.net/Tutorials/R3FExperimentalCarousels/">
						experimental carousels
					</a>{ ' ' }
					of Colin Demouge.
				</p>
			</footer>
		</>
	);
}
