import { useState } from 'react';
import { Crosshair, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
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

// Glass, as the bars of the first page are.
const GLASS = 'sq-pill border-white/10 bg-white/5 hover:bg-white/10';
const CAPTION = 'text-xs text-white/45';

type Props = {
	config: Config;
	onChange: ( change: Partial< Config > ) => void;
};

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
		<div className="grid w-32 gap-1.5">
			<Label htmlFor={ id } className="justify-between text-xs">
				<span className="text-white/45">{ label }</span>
				<span className="font-mono tabular-nums">
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
		<div className="flex h-8 items-center gap-2">
			<Switch id={ id } checked={ checked } onCheckedChange={ onChange } />
			<Label htmlFor={ id } className="text-xs">
				{ label }
			</Label>
		</div>
	);
}

/**
 * The settings of all sliders of the page: a panel of glass that stays
 * under the bar at the top.
 */
export default function Controls( { config, onChange }: Props ) {
	return (
		<TooltipProvider>
		<div
			data-testid="controls"
			role="group"
			aria-label="Settings"
			className="relative z-30 px-3 md:sticky md:top-[4.5rem] md:px-5"
		>
			<div className="sq-tile mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-5 gap-y-3 bg-black/55 px-4 py-3 ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150 md:px-6">

				<Toggle
					id="canvas"
					label="Canvas"
					checked={ config.canvas }
					onChange={ ( canvas ) => onChange( { canvas } ) }
				/>

				<div className="grid gap-1.5">
					<Label htmlFor="layer" className={ CAPTION }>
						Drawn with
					</Label>
					<Select
						value={ config.layer }
						disabled={ ! config.canvas }
						onValueChange={ ( layer: LayerName ) => onChange( { layer } ) }
					>
						<SelectTrigger id="layer" size="sm" className={ `${ GLASS } w-40` }>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ ( Object.keys( LAYERS ) as LayerName[] ).map( ( name ) => (
								<SelectItem key={ name } value={ name }>
									{ LAYERS[ name ] }
								</SelectItem>
							) ) }
						</SelectContent>
					</Select>
				</div>

				<Separator orientation="vertical" className="hidden h-8! self-center bg-white/10 md:block" />

				<ToggleGroup
					type="multiple"
					size="sm"
					spacing={ 1 }
					aria-label="Effects"
					className="sq-pill max-w-full overflow-x-auto bg-white/5 p-1 ring-1 ring-white/10 [scrollbar-width:none]"
					disabled={ ! config.canvas }
					value={ config.effects }
					onValueChange={ ( effects: EffectName[] ) =>
						onChange( { effects } )
					}
				>
					{ ( Object.keys( EFFECTS ) as EffectName[] ).map( ( name ) => (
						<Tooltip key={ name }>
							<TooltipTrigger asChild>
								<ToggleGroupItem
									value={ name }
									className="sq-pill! h-7 px-3 text-xs text-white/70 hover:bg-white/10 hover:text-white aria-pressed:bg-white! aria-pressed:text-black!"
								>
									{ EFFECTS[ name ].label }
								</ToggleGroupItem>
							</TooltipTrigger>
							<TooltipContent>{ EFFECTS[ name ].hint }</TooltipContent>
						</Tooltip>
					) ) }
				</ToggleGroup>

				<div className="grid gap-1.5">
					<Label htmlFor="pointer" className={ CAPTION }>
						Under the pointer
					</Label>
					<Select
						value={ config.pointer }
						disabled={ ! config.canvas }
						onValueChange={ ( pointer: PointerName ) =>
							onChange( { pointer } )
						}
					>
						<SelectTrigger id="pointer" size="sm" className={ `${ GLASS } w-32` }>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ ( Object.keys( POINTERS ) as PointerName[] ).map(
								( name ) => (
									<SelectItem key={ name } value={ name }>
										{ POINTERS[ name ] }
									</SelectItem>
								)
							) }
						</SelectContent>
					</Select>
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

				<div className="grid gap-1.5">
					<Label htmlFor="transition" className={ CAPTION }>
						Transition
					</Label>
					<Select
						value={ config.transition }
						disabled={ ! config.canvas }
						onValueChange={ ( transition ) => onChange( { transition } ) }
					>
						<SelectTrigger
							id="transition"
							size="sm"
							className={ `${ GLASS } w-36` }
							title="For the sliders that show one slide at a time. With none, their slides move."
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ TRANSITIONS.map( ( name ) => (
								<SelectItem key={ name } value={ name }>
									{ name === 'none' ? 'None: the slides move' : name }
								</SelectItem>
							) ) }
						</SelectContent>
					</Select>
				</div>

				<Separator orientation="vertical" className="hidden h-8! self-center bg-white/10 md:block" />

				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className={ GLASS }>
							<SlidersHorizontal />
							Slider
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="sq-tile grid w-auto grid-cols-2 gap-5 border-white/10 bg-black/70 backdrop-blur-2xl">
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
						<div className="grid content-start gap-3">
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
					</PopoverContent>
				</Popover>

				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className={ GLASS }>
							<Crosshair />
							Focus point
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="sq-tile w-auto border-white/10 bg-black/70 backdrop-blur-2xl">
						<FocusPad
							image="/media/3-480.avif"
							value={ config.focus }
							onChange={ ( focus ) => onChange( { focus } ) }
						/>
					</PopoverContent>
				</Popover>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Back to how it was"
							className="sq-pill ml-auto self-center"
							onClick={ () => onChange( DEFAULTS ) }
						>
							<RotateCcw />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Back to how it was</TooltipContent>
				</Tooltip>
			</div>
		</div>
		</TooltipProvider>
	);
}
