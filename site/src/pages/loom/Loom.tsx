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

// Ways the threads come apart: how far they reach, how many, where it
// begins, the room between them, how far their colours split, and how
// far they bend up and down.
const WAYS = {
	Loom: { amount: 1.1, threads: 90, start: 0.55, gap: 0.5, split: 0, lift: 0.04 },
	Silk: { amount: 1.8, threads: 300, start: 0.6, gap: 0.9, split: 0, lift: 0.06 },
	Rope: { amount: 0.7, threads: 16, start: 0.5, gap: 0.85, split: 0, lift: 0.03 },
	Prism: { amount: 1.2, threads: 60, start: 0.55, gap: 0.4, split: 1.4, lift: 0.05 },
	Deep: { amount: 2.6, threads: 120, start: 0.5, gap: 0.6, split: 0.5, lift: 0.09 },
};
type Way = keyof typeof WAYS;

// What the effect reads on every frame: written into, never replaced.
const PARAMS = Object.fromEntries(
	Object.entries( WAYS.Loom ).map( ( [ name, value ] ) => [ name, [ value ] ] )
) as Record< keyof ( typeof WAYS )[ Way ], number[] >;

/**
 * Loom: portraits that run by, and come apart into threads where they
 * leave the screen and where they come in. After Unwoven by Clément
 * Grellier.
 */
export default function Loom() {
	const root = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );
	const [ way, setWay ] = useState< Way >( 'Loom' );
	const slider = useRef< { wake: () => void } >( null );

	const choose = ( to: Way ) => {
		for ( const [ name, value ] of Object.entries( WAYS[ to ] ) ) {
			PARAMS[ name as keyof typeof PARAMS ][ 0 ] = value;
		}
		slider.current?.wake();
		setWay( to );
	};

	useEffect( () => {
		const made = createSlider( root.current!, {
			loop: true,
			free: true,
			align: 'center',
			plugins: [
				loading( { min: 500 } ),
				marquee( { speed: 38, hover: 0.3 } ),
				wheel(),
				keyboard(),
				canvas( {
					effects: [ unweave( PARAMS ), stretch( { amount: 0.6 } ) ],
					layer: layer(),
				} ),
			],
			on: {
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
			},
		} );
		slider.current = made;
		Object.assign( window, { slider: made } );
		return () => made.destroy();
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
				<div className="ways" role="group" aria-label="How the threads come apart">
					{ ( Object.keys( WAYS ) as Way[] ).map( ( one ) => (
						<button
							key={ one }
							type="button"
							aria-pressed={ one === way }
							onClick={ () => choose( one ) }
						>
							{ one }
						</button>
					) ) }
				</div>
			</main>
			<footer>
				<p>
					The row runs by itself; drag it, or turn the wheel. At the edges
					of the screen the pictures come apart into threads:{ ' ' }
					<code>unweave()</code>. The pills above choose how: long or short
					threads, fine or coarse, close or apart, their colours split.
				</p>
				<p>
					After <a href="https://tympanus.net/Development/Unwoven/">Unwoven</a>{ ' ' }
					by Clément Grellier. Photos from Pexels.
				</p>
			</footer>
		</>
	);
}
