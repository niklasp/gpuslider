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
	TRANSITIONS,
	type Config,
	type EffectName,
} from '@/lib/config';
import { FocusPad } from '@/components/FocusPad';

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
				<span className="text-muted-foreground">{ label }</span>
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
		<div className="flex items-center gap-2">
			<Switch id={ id } checked={ checked } onCheckedChange={ onChange } />
			<Label htmlFor={ id } className="text-xs">
				{ label }
			</Label>
		</div>
	);
}

/** The settings of all sliders of the page, which stay at its top. */
export default function Controls( { config, onChange }: Props ) {
	return (
		<TooltipProvider>
		<header
			data-testid="controls"
			className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl"
		>
			<div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 md:px-8">
				<a href="#top" className="mr-1 text-base font-semibold tracking-tight">
					shaderslide
				</a>

				<Toggle
					id="canvas"
					label="Canvas"
					checked={ config.canvas }
					onChange={ ( canvas ) => onChange( { canvas } ) }
				/>

				<Separator orientation="vertical" className="h-6!" />

				<ToggleGroup
					type="multiple"
					variant="outline"
					size="sm"
					spacing={ 0 }
					aria-label="Effects"
					disabled={ ! config.canvas }
					value={ config.effects }
					onValueChange={ ( effects: EffectName[] ) =>
						onChange( { effects } )
					}
				>
					{ ( Object.keys( EFFECTS ) as EffectName[] ).map( ( name ) => (
						<Tooltip key={ name }>
							<TooltipTrigger asChild>
								<ToggleGroupItem value={ name } className="px-3 text-xs">
									{ EFFECTS[ name ].label }
								</ToggleGroupItem>
							</TooltipTrigger>
							<TooltipContent>{ EFFECTS[ name ].hint }</TooltipContent>
						</Tooltip>
					) ) }
				</ToggleGroup>

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
					<Label htmlFor="transition" className="text-xs text-muted-foreground">
						Transition of the stack
					</Label>
					<Select
						value={ config.transition }
						disabled={ ! config.canvas }
						onValueChange={ ( transition ) => onChange( { transition } ) }
					>
						<SelectTrigger id="transition" size="sm" className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ TRANSITIONS.map( ( name ) => (
								<SelectItem key={ name } value={ name }>
									{ name }
								</SelectItem>
							) ) }
						</SelectContent>
					</Select>
				</div>

				<Separator orientation="vertical" className="h-6!" />

				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm">
							<SlidersHorizontal />
							Slider
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="grid w-auto grid-cols-2 gap-5">
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
						<Button variant="outline" size="sm">
							<Crosshair />
							Focus point
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-auto">
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
							className="ml-auto"
							onClick={ () => onChange( DEFAULTS ) }
						>
							<RotateCcw />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Back to how it was</TooltipContent>
				</Tooltip>
			</div>
		</header>
		</TooltipProvider>
	);
}
