import {
	useEffect,
	useRef,
	type CSSProperties,
	type ReactNode,
} from 'react';
import { createSlider } from 'shaderslide';
import { ChevronLeft, ChevronRight, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
	id: string;
	label: string;
	className?: string;
	style?: CSSProperties;
	/** Options of the slider, without the layers. */
	options: Record< string, unknown >;
	/** Makes the layers; called whenever the slider is made. */
	layers: () => unknown[];
	/** Changes with what makes the slider another slider. */
	made: string;
	/** Changes with what the slider has to measure again for. */
	measured: string;
	pause?: boolean;
	children: ReactNode;
};

const button =
	'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-20 disabled:cursor-default';

/**
 * A slider of the library in React: React renders the slides, the library
 * moves them.
 */
export function ShaderSlider( {
	id,
	label,
	className,
	style,
	options,
	layers,
	made,
	measured,
	pause,
	children,
}: Props ) {
	const root = useRef< HTMLDivElement >( null );
	const state = useRef< HTMLParagraphElement >( null );
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const slider = useRef< any >( null );
	const at = useRef( 0 );

	useEffect( () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const made_: any = createSlider( root.current!, {
			...options,
			start: at.current,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			layers: layers() as any,
		} );
		slider.current = made_;
		const names = ( window as unknown as { sliders: Record< string, unknown > } );
		names.sliders = { ...names.sliders, [ id ]: made_ };

		const tell = () => {
			if ( state.current ) {
				const drawing = made_.layers[ 0 ]?.canvas ? 'canvas' : 'page';
				state.current.textContent = `${ made_.index + 1 } of ${ made_.count() } · drawn by the ${ drawing } · ${ Math.abs(
					made_.view.velocity
				).toFixed( 1 ) } views per second`;
			}
		};
		made_.on( 'frame', tell );
		tell();
		return () => {
			at.current = made_.index;
			made_.destroy();
			slider.current = null;
		};
		// The options and layers follow from `made`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ made ] );

	useEffect( () => {
		slider.current?.update();
	}, [ measured ] );

	return (
		<div className="min-w-0">
			<div
				ref={ root }
				id={ id }
				data-made={ made }
				aria-label={ label }
				className={ cn( 'ss rounded-xl', className ) }
				style={ style }
			>
				<div className="ss-track">{ children }</div>
				<button
					type="button"
					data-ss-prev
					aria-label="Previous slide"
					className={ cn( button, 'start-3' ) }
				>
					<ChevronLeft className="size-5" />
				</button>
				<button
					type="button"
					data-ss-next
					aria-label="Next slide"
					className={ cn( button, 'end-3' ) }
				>
					<ChevronRight className="size-5" />
				</button>
				{ pause && (
					<button
						type="button"
						data-ss-pause
						aria-label="Pause autoplay"
						className="absolute end-3 bottom-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-black/50 text-white backdrop-blur aria-pressed:bg-white aria-pressed:text-black"
					>
						<Pause className="size-3.5" />
					</button>
				) }
				<div
					data-ss-dots
					className="dots absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2"
				/>
			</div>
			<p
				ref={ state }
				className="mt-2 font-mono text-xs text-muted-foreground"
			/>
		</div>
	);
}

type SlideProps = {
	src: string;
	alt: string;
	video?: boolean;
	className?: string;
	width?: number;
	height?: number;
	children?: ReactNode;
};

export function Slide( {
	src,
	alt,
	video,
	className,
	width,
	height,
	children,
}: SlideProps ) {
	return (
		<div className={ cn( 'ss-slide', className ) }>
			{ video ? (
				<video
					className="ss-media"
					src={ src }
					aria-label={ alt }
					muted
					playsInline
					loop
					autoPlay
				/>
			) : (
				<img
					className="ss-media"
					src={ src }
					alt={ alt }
					width={ width }
					height={ height }
					draggable={ false }
				/>
			) }
			{ children && (
				<div className="ss-content flex flex-col justify-end gap-1 bg-gradient-to-b from-transparent from-40% to-black/70 p-6 pb-12 text-white md:p-10 md:pb-14">
					{ children }
				</div>
			) }
		</div>
	);
}
