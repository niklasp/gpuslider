import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import './depth.css';
import { createSlider, type Slider } from 'gpuslider';
import { controls, keyboard, loading, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { parallax, stretch } from 'gpuslider/effects';
import { image, photo } from '@/lib/media';
import { Bar, drawnBy, layer } from '../mount';

const SLIDES = [ 1, 2, 3, 4, 7, 5, 6, 8 ];

/**
 * What the panel changes: arrays the effects read on every frame, so
 * nothing is made again.
 */
const LIVE = {
	amount: [ 0.4 ],
	zoom: [ 0.1 ],
	stretch: [ 1 ],
};

const KNOBS = [
	{ name: 'amount', label: 'Depth', min: 0, max: 1, step: 0.01 },
	{ name: 'zoom', label: 'Room around', min: 0, max: 0.6, step: 0.01 },
	{ name: 'stretch', label: 'Give way', min: 0, max: 3, step: 0.05 },
] as const;

/**
 * Depth: a gallery whose pictures move slower than their frames, with the
 * numbers of it at hand. After the Horizontal Parallax Gallery of Codrops.
 */
export default function Depth() {
	const root = useRef< HTMLDivElement >( null );
	const slider = useRef< Slider | null >( null );
	const [ by, setBy ] = useState( '' );
	const [ values, setValues ] = useState( () =>
		Object.fromEntries( KNOBS.map( ( { name } ) => [ name, LIVE[ name ][ 0 ] ] ) )
	);

	useEffect( () => {
		slider.current = createSlider( root.current!, {
			loop: true,
			duration: 900,
			plugins: [
				loading( { min: 500 } ),
				controls(),
				keyboard(),
				wheel(),
				canvas( {
					effects: [
						parallax( { amount: LIVE.amount, zoom: LIVE.zoom } ),
						stretch( { amount: LIVE.stretch } ),
					],
					layer: layer(),
				} ),
			],
			on: {
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
			},
		} );
		Object.assign( window, { slider: slider.current } );
		return () => slider.current?.destroy();
	}, [] );

	return (
		<>
			<header>
				<Bar>Depth{ by && ` · drawn by ${ by }` }</Bar>
			</header>

			<form className="panel" aria-label="Depth" onSubmit={ ( event ) => event.preventDefault() }>
				{ KNOBS.map( ( { name, label, min, max, step } ) => (
					<label key={ name }>
						<span>{ label }</span>
						<input
							type="range"
							min={ min }
							max={ max }
							step={ step }
							value={ values[ name ] }
							onChange={ ( event ) => {
								const to = Number( event.target.value );
								LIVE[ name ][ 0 ] = to;
								setValues( ( now ) => ( { ...now, [ name ]: to } ) );
								// Drawn again, though nothing moves.
								slider.current?.wake();
							} }
						/>
						<output>{ values[ name ].toFixed( 2 ) }</output>
					</label>
				) ) }
			</form>

			<div ref={ root } className="gs gallery" aria-label="Photos">
				<div className="gs-track">
					{ SLIDES.map( ( n, i ) => (
						<div className="gs-slide" key={ i }>
							<img
								className="gs-media"
								{ ...image( n, 'photos' ) }
								sizes="(max-width: 700px) 90vw, 55vw"
								alt={ photo( n ).alt }
								draggable={ false }
							/>
						</div>
					) ) }
				</div>
				<button type="button" className="arrow" data-gs-prev aria-label="Previous" />
				<button type="button" className="arrow" data-gs-next aria-label="Next" />
			</div>

			<footer>
				<p>
					Drag, turn the wheel or use the arrow keys. The picture moves slower
					than its frame: <code>parallax()</code>. The panel writes into the
					numbers the effects read on every frame.
				</p>
				<p>
					After the{ ' ' }
					<a href="https://tympanus.net/Tutorials/HorizontalParallaxGallery/">
						Horizontal Parallax Gallery
					</a>{ ' ' }
					of Codrops. Photos from Pexels.
				</p>
			</footer>
		</>
	);
}
