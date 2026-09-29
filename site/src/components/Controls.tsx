import { useEffect, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
	DEFAULTS,
	EFFECTS,
	LAYERS,
	POINTERS,
	TRANSITIONS,
	type Config,
	type EffectName,
	type LayerName,
	type PointerName,
} from '@/lib/config';
import { FocusPad } from '@/components/FocusPad';

type Props = {
	config: Config;
	onChange: ( change: Partial< Config > ) => void;
};

/** A choice that can be pressed: a squircle that is white when it is on. */
const CHIP =
	'sq-knob h-8 cursor-pointer px-3 text-xs font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-40 aria-pressed:bg-white aria-pressed:text-black aria-pressed:ring-white aria-checked:bg-white aria-checked:text-black aria-checked:ring-white';

/** A field that opens a list. */
const FIELD = 'sq-knob w-full border-white/10 bg-white/5 hover:bg-white/10';

type RangeProps = {
	id: string;
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	unit?: string;
	/** While the thumb moves. */
	onChange?: ( value: number ) => void;
	/** When the thumb is let go: for what makes the sliders again. */
	onCommit?: ( value: number ) => void;
};

function Range( {
	id,
	label,
	value,
	min,
	max,
	step,
	unit = '',
	onChange,
	onCommit,
}: RangeProps ) {
	const [ moving, setMoving ] = useState< number | null >( null );
	const shown = moving ?? value;
	return (
		<div className="grid gap-2.5">
			<Label htmlFor={ id } className="justify-between text-xs">
				<span className="text-white/60">{ label }</span>
				<span className="font-mono text-white tabular-nums">
					{ shown }
					{ unit }
				</span>
			</Label>
			<Slider
				id={ id }
				data-testid={ id }
				aria-label={ label }
				value={ [ shown ] }
				min={ min }
				max={ max }
				step={ step }
				onValueChange={ ( [ to ] ) => {
					setMoving( to );
					onChange?.( to );
				} }
				onValueCommit={ ( [ to ] ) => {
					setMoving( null );
					onCommit?.( to );
				} }
			/>
		</div>
	);
}

function Toggle( {
	id,
	label,
	checked,
	onChange,
}: {
	id: string;
	label: string;
	checked: boolean;
	onChange: ( checked: boolean ) => void;
} ) {
	return (
		<div className="flex h-8 items-center justify-between gap-3">
			<Label htmlFor={ id } className="text-sm font-normal text-white/80">
				{ label }
			</Label>
			<Switch id={ id } checked={ checked } onCheckedChange={ onChange } />
		</div>
	);
}

/** A part of the sidebar, with its name. */
function Part( { title, children }: { title: string; children: ReactNode } ) {
	return (
		<section className="grid gap-3 border-t border-white/8 px-5 py-5">
			<h2 className="text-xs font-medium text-white/45">{ title }</h2>
			{ children }
		</section>
	);
}

/**
 * The settings of all sliders of the page, in a sidebar of glass beside
 * them that pushes the page aside, and folds away to a rail. Open where
 * there is room for it, folded on a phone.
 */
export default function Controls( { config, onChange }: Props ) {
	const [ open, setOpen ] = useState( true );
	useEffect( () => {
		if ( ! matchMedia( '(min-width: 1024px)' ).matches ) {
			setOpen( false );
		}
	}, [] );
	const off = ! config.canvas;

	return (
		<div
			className={ `sticky top-[4.5rem] z-30 h-[calc(100svh-4.5rem)] shrink-0 pt-1 pb-3 ps-3 md:pb-5 transition-[width] duration-300 ease-out md:ps-5 ${
				open ? 'w-[min(324px,100vw)]' : 'w-[4.25rem] md:w-[4.75rem]'
			}` }
		>
			<aside
				id="settings"
				data-testid="controls"
				aria-label="Settings"
				className="sq-tile h-full overflow-x-hidden overflow-y-auto overscroll-contain bg-white/[0.04] ring-1 ring-white/10 [scrollbar-width:thin]"
			>
				<div
					className={ `sticky top-0 z-10 flex items-center bg-black/50 py-3 backdrop-blur-xl ${
						open ? 'justify-between ps-5 pe-3' : 'justify-center'
					}` }
				>
					{ open && (
						<span className="font-display text-base font-semibold tracking-[-0.02em]">
							Settings
						</span>
					) }
					<div className="flex gap-1">
						{ open && (
							<button
								type="button"
								className="sq-knob grid size-8 cursor-pointer place-items-center text-white/60 transition hover:bg-white/10 hover:text-white"
								aria-label="Back to how it was"
								title="Back to how it was"
								onClick={ () => onChange( DEFAULTS ) }
							>
								<RotateCcw className="size-4" />
							</button>
						) }
						<button
							type="button"
							className="sq-knob grid size-8 cursor-pointer place-items-center text-white/60 transition hover:bg-white/10 hover:text-white"
							aria-label={ open ? 'Fold the settings away' : 'Open the settings' }
							aria-expanded={ open }
							aria-controls="settings-parts"
							title={ open ? 'Fold away' : 'Settings' }
							onClick={ () => setOpen( ! open ) }
						>
							{ open ? (
								<PanelLeftClose className="size-4" />
							) : (
								<PanelLeftOpen className="size-4" />
							) }
						</button>
					</div>
				</div>

				<div id="settings-parts" hidden={ ! open } className="w-[calc(324px-2rem)]">
				<Part title="Drawing">
					<Toggle
						id="canvas"
						label="Canvas"
						checked={ config.canvas }
						onChange={ ( canvas ) => onChange( { canvas } ) }
					/>
					<div className="grid gap-1.5">
						<Label htmlFor="layer" className="text-xs text-white/60">
							Drawn with
						</Label>
						<Select
							value={ config.layer }
							disabled={ off }
							onValueChange={ ( layer: LayerName ) => onChange( { layer } ) }
						>
							<SelectTrigger id="layer" className={ FIELD }>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="sq-knob">
								{ ( Object.keys( LAYERS ) as LayerName[] ).map( ( name ) => (
									<SelectItem key={ name } value={ name }>
										{ LAYERS[ name ] }
									</SelectItem>
								) ) }
							</SelectContent>
						</Select>
					</div>
				</Part>

				<Part title="Effects">
					<div role="group" aria-label="Effects" className="flex flex-wrap gap-1.5">
						{ ( Object.keys( EFFECTS ) as EffectName[] ).map( ( name ) => {
							const on = config.effects.includes( name );
							return (
								<button
									key={ name }
									type="button"
									className={ CHIP }
									title={ EFFECTS[ name ].hint }
									aria-pressed={ on }
									disabled={ off }
									onClick={ () =>
										onChange( {
											effects: on
												? config.effects.filter( ( one ) => one !== name )
												: [ ...config.effects, name ],
										} )
									}
								>
									{ EFFECTS[ name ].label }
								</button>
							);
						} ) }
					</div>
					<Range
						id="intensity"
						label="Strength"
						value={ config.intensity }
						min={ 0 }
						max={ 3 }
						step={ 0.1 }
						onCommit={ ( intensity ) => onChange( { intensity } ) }
					/>
				</Part>

				<Part title="Under the pointer">
					<div
						role="radiogroup"
						aria-label="Under the pointer"
						className="flex flex-wrap gap-1.5"
					>
						{ ( Object.keys( POINTERS ) as PointerName[] ).map( ( name ) => (
							<button
								key={ name }
								type="button"
								role="radio"
								className={ CHIP }
								aria-checked={ config.pointer === name }
								disabled={ off }
								onClick={ () => onChange( { pointer: name } ) }
							>
								{ POINTERS[ name ] }
							</button>
						) ) }
					</div>
				</Part>

				<Part title="One slide at a time">
					<div className="grid gap-1.5">
						<Label htmlFor="transition" className="text-xs text-white/60">
							Transition
						</Label>
						<Select
							value={ config.transition }
							disabled={ off }
							onValueChange={ ( transition ) => onChange( { transition } ) }
						>
							<SelectTrigger
								id="transition"
								className={ FIELD }
								title="For the sliders that show one slide at a time. With none, their slides move."
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="sq-knob">
								{ TRANSITIONS.map( ( name ) => (
									<SelectItem key={ name } value={ name }>
										{ name === 'none'
											? 'None: the slides move'
											: name === 'random'
											? 'Random: another every time'
											: name }
									</SelectItem>
								) ) }
							</SelectContent>
						</Select>
					</div>
				</Part>

				<Part title="Slider">
					<Range
						id="per-view"
						label="Per view"
						value={ config.perView }
						min={ 1 }
						max={ 5 }
						step={ 0.5 }
						onChange={ ( perView ) => onChange( { perView } ) }
					/>
					<Range
						id="gap"
						label="Gap"
						value={ config.gap }
						min={ 0 }
						max={ 48 }
						step={ 2 }
						unit="px"
						onChange={ ( gap ) => onChange( { gap } ) }
					/>
					<Range
						id="duration"
						label="Time of a move"
						value={ config.duration }
						min={ 200 }
						max={ 2000 }
						step={ 50 }
						unit="ms"
						onCommit={ ( duration ) => onChange( { duration } ) }
					/>
					<div className="grid">
						<Toggle
							id="loop"
							label="Loop"
							checked={ config.loop }
							onChange={ ( loop ) => onChange( { loop } ) }
						/>
						<Toggle
							id="free"
							label="Rest anywhere"
							checked={ config.free }
							onChange={ ( free ) => onChange( { free } ) }
						/>
						<Toggle
							id="autoplay"
							label="Autoplay"
							checked={ config.autoplay }
							onChange={ ( autoplay ) => onChange( { autoplay } ) }
						/>
						<Toggle
							id="lightbox"
							label="Lightbox"
							checked={ config.lightbox }
							onChange={ ( lightbox ) => onChange( { lightbox } ) }
						/>
					</div>
				</Part>

				<Part title="Focus point">
					<FocusPad
						image="/media/3-480.avif"
						value={ config.focus }
						onChange={ ( focus ) => onChange( { focus } ) }
					/>
				</Part>
				</div>
			</aside>
		</div>
	);
}
