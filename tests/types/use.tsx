/**
 * Not run: compiled, to see that the types of the components say what
 * they do. `npm run types`.
 */
import { useState } from 'react';
import { type Slider as Made } from 'gpuslider';
import { Slider, Slide, useSlider, useSliderContext } from 'gpuslider/react';
import { controls, keyboard } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch } from 'gpuslider/effects';

function Next() {
	const slider = useSliderContext();
	return (
		<button disabled={ ! slider?.canNext } onClick={ () => slider?.next() }>
			On
		</button>
	);
}

export function Photos( { photos }: { photos: { src: string; alt: string }[] } ) {
	const [ at, setAt ] = useState( 0 );
	const [ made, setMade ] = useState< Made | null >( null );
	return (
		<Slider
			as="section"
			loop
			align="center"
			perView={ 3 }
			gap={ 16 }
			duration={ 500 }
			index={ at }
			className="photos"
			style={ { height: 400 } }
			aria-label="Photos"
			plugins={ [ controls(), keyboard(), canvas( { effects: [ stretch() ] } ) ] }
			remake={ [ photos.length > 3 ] }
			onChange={ ( index: number ) => setAt( index ) }
			onSettle={ ( index, slider ) => slider.index === index }
			onSlider={ setMade }
			on={ { 'lightbox:open': ( index: number ) => index } }
			around={ <Next /> }
		>
			{ photos.map( ( photo ) => (
				<Slide key={ photo.src } as="figure" className="photo" data-made={ !! made }>
					<img className="gs-media" { ...photo } />
				</Slide>
			) ) }
		</Slider>
	);
}

export function Own() {
	const [ ref, slider ] = useSlider( { loop: true }, [] );
	return (
		<div className="gs" ref={ ref }>
			<div className="gs-track" />
			<button onClick={ () => slider?.next() }>On</button>
		</div>
	);
}

// @ts-expect-error No such alignment.
export const wrong = <Slider align="middle" />;
