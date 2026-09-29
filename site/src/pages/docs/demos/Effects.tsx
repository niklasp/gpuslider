import { useState, type CSSProperties } from 'react';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import { BUTTON } from '@/components/Frame';
import {
	DEFAULTS,
	EFFECTS,
	POINTERS,
	TRANSITIONS,
	pluginsOf,
	type Config,
	type EffectName,
	type Kind,
	type PointerName,
} from '@/lib/config';

/** Effects that say where a slide is drawn, and the slider they are for. */
const LAID: Record< string, Kind > = {
	coverflow: 'covers',
	pile: 'pile',
	fan: 'fan',
};

function Choice< Name extends string >( {
	label,
	names,
	said = ( name ) => name,
	chosen,
	onChoose,
}: {
	label: string;
	names: Name[];
	said?: ( name: Name ) => string;
	chosen: Name[];
	onChoose: ( name: Name ) => void;
} ) {
	return (
		<div
			role="group"
			aria-label={ label }
			className="flex flex-wrap items-center gap-1.5"
		>
			<span className="w-full text-xs text-muted-foreground">{ label }</span>
			{ names.map( ( name ) => (
				<button
					key={ name }
					type="button"
					className={ BUTTON }
					aria-pressed={ chosen.includes( name ) }
					aria-current={ chosen.includes( name ) ? 'true' : undefined }
					onClick={ () => onChoose( name ) }
				>
					{ said( name ) }
				</button>
			) ) }
		</div>
	);
}

/**
 * Every effect and every transition, to be switched on: a row for what
 * moves with the speed and the pointer, a slider that is laid out by an
 * effect, and a stack for the transitions.
 */
export default function Effects() {
	const [ effects, setEffects ] = useState< EffectName[] >( [
		'stretch',
		'split',
	] );
	const [ pointer, setPointer ] = useState< PointerName >( 'waves' );
	const [ laid, setLaid ] = useState( 'coverflow' );
	const [ transition, setTransition ] = useState( 'liquid' );
	const config: Config = {
		...DEFAULTS,
		effects,
		pointer,
		transition,
		lightbox: false,
	};
	return (
		<>
			<Choice
				label="With the speed and the place: any number"
				names={ Object.keys( EFFECTS ) as EffectName[] }
				said={ ( name ) => name }
				chosen={ effects }
				onChoose={ ( name ) =>
					setEffects( ( now ) =>
						now.includes( name )
							? now.filter( ( one ) => one !== name )
							: [ ...now, name ]
					)
				}
			/>
			<Choice
				label="Under the pointer"
				names={ Object.keys( POINTERS ) as PointerName[] }
				said={ ( name ) => ( name === 'none' ? 'nothing' : name ) }
				chosen={ [ pointer ] }
				onChoose={ setPointer }
			/>
			<GpuSlider
				id="row"
				label="A row with the effects that are chosen"
				options={ { loop: true } }
				className="cards"
				style={ { '--gs-per-view': 3, '--gs-gap': '16px' } as CSSProperties }
				made={ `${ effects } ${ pointer }` }
				measured=""
				plugins={ () => pluginsOf( config ) }
			>
				{ [ 1, 2, 3, 4, 5, 6, 7, 8 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="card"
						sizes="(max-width: 640px) 77vw, 30vw"
					/>
				) ) }
			</GpuSlider>

			<Choice
				label="Effects that lay out"
				names={ Object.keys( LAID ) }
				chosen={ [ laid ] }
				onChoose={ setLaid }
			/>
			<GpuSlider
				id="laid"
				label="A slider that an effect lays out"
				options={ { loop: true, align: 'center' } }
				className={ laid === 'coverflow' ? 'covers' : 'laid' }
				made={ `${ laid } ${ pointer }` }
				measured={ laid }
				plugins={ () =>
					pluginsOf( { ...config, effects: [] }, LAID[ laid ] )
				}
			>
				{ [ 2, 4, 6, 8, 1, 3, 5 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="cover"
						sizes="(max-width: 640px) 60vw, 25vw"
					/>
				) ) }
			</GpuSlider>

			<Choice
				label="Transitions: one at a time"
				names={ TRANSITIONS.filter( ( name ) => name !== 'none' && name !== 'random' ) }
				chosen={ [ transition ] }
				onChoose={ setTransition }
			/>
			<GpuSlider
				id="turns"
				label="A stack with the transition that is chosen"
				options={ { loop: true, duration: 1100 } }
				made={ transition }
				measured=""
				plugins={ () =>
					pluginsOf( { ...config, effects: [], pointer: 'none' }, 'stack' )
				}
			>
				{ [ 6, 4, 2, 1 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="hero"
						sizes="70vw"
					/>
				) ) }
			</GpuSlider>
			<p className="note">
				Drag the sliders: what moves with the speed shows while they move.
				Drag the stack slowly to stop a transition half way.
			</p>
		</>
	);
}
