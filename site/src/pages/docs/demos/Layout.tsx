import { useState, type CSSProperties } from 'react';
import { ShaderSlider, Slide } from '@/components/ShaderSlider';
import { controls, keyboard, wheel } from 'shaderslide/plugins';

const plugins = () => [ controls(), keyboard(), wheel() ];

function Range( {
	label,
	value,
	unit = '',
	onChange,
	...range
}: {
	label: string;
	value: number;
	unit?: string;
	min: number;
	max: number;
	step: number;
	onChange: ( value: number ) => void;
} ) {
	return (
		<label className="grid w-40 gap-1.5 text-xs">
			<span className="flex justify-between">
				<span className="text-muted-foreground">{ label }</span>
				<span className="font-mono tabular-nums">
					{ value }
					{ unit }
				</span>
			</span>
			<input
				type="range"
				value={ value }
				onChange={ ( event ) => onChange( Number( event.target.value ) ) }
				{ ...range }
			/>
		</label>
	);
}

/**
 * Custom properties that are written while the slider is there, a slider
 * that goes down, and rows.
 */
export default function Layout() {
	const [ perView, setPerView ] = useState( 3 );
	const [ gap, setGap ] = useState( 16 );
	const measured = `${ perView } ${ gap }`;
	return (
		<>
			<div className="flex flex-wrap gap-6">
				<Range
					label="--ss-per-view"
					value={ perView }
					min={ 1 }
					max={ 5 }
					step={ 0.5 }
					onChange={ setPerView }
				/>
				<Range
					label="--ss-gap"
					value={ gap }
					unit="px"
					min={ 0 }
					max={ 48 }
					step={ 2 }
					onChange={ setGap }
				/>
			</div>
			<ShaderSlider
				id="several"
				label="Several per view"
				options={ {} }
				className="cards"
				style={
					{ '--ss-per-view': perView, '--ss-gap': `${ gap }px` } as CSSProperties
				}
				made=""
				measured={ measured }
				plugins={ plugins }
			>
				{ [ 1, 2, 3, 4, 5, 6, 7, 8 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="card"
						sizes="33vw"
					/>
				) ) }
			</ShaderSlider>
			<div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
				<ShaderSlider
					id="down"
					label="Downwards"
					options={ { axis: 'y' } }
					className="down"
					style={ { '--ss-gap': `${ gap }px` } as CSSProperties }
					made=""
					measured={ measured }
					plugins={ plugins }
					bare
				>
					{ [ 6, 1, 4, 7, 2 ].map( ( n ) => (
						<Slide
							key={ n }
							image={ n }
							alt={ `Colour field ${ n }` }
							sizes="(min-width: 768px) 30vw, 100vw"
						/>
					) ) }
				</ShaderSlider>
				<ShaderSlider
					id="rows"
					label="Two rows"
					options={ {} }
					className="rows"
					style={ { '--ss-gap': `${ gap }px` } as CSSProperties }
					made=""
					measured={ measured }
					plugins={ plugins }
				>
					{ [ 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4 ].map( ( n, i ) => (
						<Slide
							key={ i }
							image={ n }
							alt={ `Colour field ${ n }` }
							sizes="(min-width: 768px) 15vw, 50vw"
						/>
					) ) }
				</ShaderSlider>
			</div>
			<p className="note">
				The two at the top write custom properties of the first slider, and
				the gap of the others. One goes downwards: <code>axis: 'y'</code> and
				a height. One has two rows, which are a grid of CSS.
			</p>
		</>
	);
}
