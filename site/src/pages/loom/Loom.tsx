import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import './loom.css';
import { createSlider } from 'gpuslider';
import { keyboard, loading, marquee, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch, unweave } from 'gpuslider/effects';
import { image, photo } from '@/lib/media';
import { drawnBy, layer } from '../mount';

// The four photos, twice: a row longer than the screen.
const SLIDES = [ 1, 2, 3, 4, 7, 5, 6, 8 ];

/**
 * Loom: portraits that run by, and come apart into threads where they
 * leave the screen and where they come in. After Unwoven by Clément
 * Grellier.
 */
export default function Loom() {
	const root = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const slider = createSlider( root.current!, {
			loop: true,
			free: true,
			align: 'center',
			plugins: [
				loading( { min: 500 } ),
				marquee( { speed: 38, hover: 0.3 } ),
				wheel(),
				keyboard(),
				canvas( {
					effects: [ unweave( { amount: 1.1, threads: 90 } ), stretch( { amount: 0.6 } ) ],
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
				<span>Loom{ by && ` · drawn by ${ by }` }</span>
			</header>
			<main>
				<div ref={ root } className="gs loom" aria-label="Portraits">
					<div className="gs-track">
						{ SLIDES.map( ( n, i ) => (
							<div className="gs-slide" key={ i }>
								<img
									className="gs-media"
									{ ...image( n, 'photos' ) }
									sizes="(max-width: 700px) 70vw, 30vw"
									alt={ photo( n ).alt }
									draggable={ false }
								/>
							</div>
						) ) }
					</div>
				</div>
			</main>
			<footer>
				<p>
					The row runs by itself; drag it, or turn the wheel. At the edges
					of the screen the pictures come apart into threads:{ ' ' }
					<code>unweave()</code>.
				</p>
				<p>
					After <a href="https://tympanus.net/Development/Unwoven/">Unwoven</a>{ ' ' }
					by Clément Grellier. Photos from Pexels.
				</p>
			</footer>
		</>
	);
}
