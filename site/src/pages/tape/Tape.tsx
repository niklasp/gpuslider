import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import './tape.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading, marquee } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch, split, jelly } from 'gpuslider/effects';
import pictures from '@/lib/wall.json';
import { pinned } from '@/lib/media';
import { drawnBy, layer } from '../mount';

const WORDS = [ 'Film', 'Field', 'Sound', 'Print' ];
const IN_A_ROW = 8;

/**
 * Tape: four tickers that run against each other. The page that is
 * scrolled pushes them, and what is pushed gives way.
 *
 * The screen while the pictures load is the one the library makes, one in
 * every row, and they count together.
 */
export default function Tape() {
	const page = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const together = loading( { min: 600 } );
		const tapes: Slider[] = [
			...page.current!.querySelectorAll< HTMLElement >( '.tape' ),
		].map( ( root, i ) =>
			createSlider( root, {
				loop: true,
				free: true,
				plugins: [
					together,
					marquee( {
						speed: i % 2 ? -46 : 46,
						hover: 0.25,
						scroll: 0.7,
						turn: true,
					} ),
					canvas( {
						effects: [ jelly( { amount: 0.7 } ), stretch(), split() ],
						layer: layer(),
					} ),
				],
				on: {
					'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
				},
			} )
		);
		Object.assign( window, { tapes } );
		return () => tapes.forEach( ( tape ) => tape.destroy() );
	}, [] );

	return (
		<div ref={ page }>
			<header>
				<a href="/examples/">gpu slider</a>
				<span id="said">Scroll{ by && ` · drawn by ${ by }` }</span>
			</header>

			<h1>
				Nothing
				<br />
				stands
				<br />
				still
			</h1>

			{ WORDS.map( ( word, row ) => (
				<section key={ word }>
					<p className="word" aria-hidden="true">
						{ word }
					</p>
					<div className="gs tape" aria-label={ `${ word }: a row of pictures` }>
						<div className="gs-track">
							{ Array.from( { length: IN_A_ROW }, ( _, i ) => {
								const n = ( row * 6 + i * 5 ) % pictures.length;
								return (
									<div className="gs-slide" key={ n }>
										<img
											className="gs-media"
											{ ...pinned( n, 'clamp(220px, 30vw, 520px)' ) }
											alt={ `${ pictures[ n ].title }. ${ pictures[ n ].line }` }
											draggable={ false }
										/>
									</div>
								);
							} ) }
						</div>
					</div>
				</section>
			) ) }

			<p className="end">
				The rows run by themselves, slower under the pointer. The page that
				is scrolled pushes them, and what is pushed gives way. Scroll up,
				and they all turn round.
			</p>
		</div>
	);
}
