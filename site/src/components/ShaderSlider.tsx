import {
	useEffect,
	useRef,
	type CSSProperties,
	type ReactNode,
} from 'react';
import { type Create, type Options, type Slider } from 'shaderslide';
import { useSlider } from 'shaderslide/react';
import { thumbs } from 'shaderslide/plugins';
import { ChevronLeft, ChevronRight, Pause } from 'lucide-react';

// Classes that do not contradict each other need no merger.
const cn = ( ...classes: ( string | undefined )[] ) =>
	classes.filter( Boolean ).join( ' ' );
import { image, video } from '@/lib/media';

type Props = {
	id: string;
	label: string;
	className?: string;
	style?: CSSProperties;
	/** Options of the slider, without the plugins. */
	options: Options;
	/** Makes the plugins; called whenever the slider is made. */
	plugins: () => Create[];
	/** Hears every event of the slider but its frames. */
	heard?: ( name: string, detail: unknown ) => void;
	/** No arrows and dots in the slider: they are somewhere else. */
	bare?: boolean;
	/** Is given the slider when it is made, and null when it ends. */
	onSlider?: ( slider: Slider | null ) => void;
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
	plugins,
	made,
	measured,
	pause,
	heard,
	bare,
	onSlider,
	children,
}: Props ) {
	const state = useRef< HTMLParagraphElement >( null );
	// The listener of now, for a slider that was made before.
	const hears = useRef( heard );
	hears.current = heard;

	// The options and plugins follow from `made`.
	const [ root, slider ] = useSlider(
		{
			...options,
			plugins: plugins(),
			on: {
				'*': ( name: string, detail: unknown ) =>
					name !== 'frame' && hears.current?.( name, detail ),
			},
		},
		[ made ]
	);

	useEffect( () => {
		if ( ! slider ) {
			return;
		}
		const names = ( window as unknown as { sliders: Record< string, unknown > } );
		names.sliders = { ...names.sliders, [ id ]: slider };

		const tell = () => {
			if ( state.current ) {
				const drawing = slider.plugins.gl?.canvas ? 'canvas' : 'page';
				state.current.textContent = `${ slider.index + 1 } of ${ slider.count() } · drawn by the ${ drawing } · ${ Math.abs(
					slider.view.velocity
				).toFixed( 1 ) } views per second`;
			}
		};
		tell();
		return slider.on( 'frame', tell );
	}, [ slider, id ] );

	useEffect( () => {
		onSlider?.( slider );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ slider ] );

	useEffect( () => {
		slider?.update();
		// A new slider has measured itself.
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				{ ! bare && (
					<>
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
					</>
				) }
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
				{ ! bare && (
					<div
						data-ss-dots
						className="dots absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2"
					/>
				) }
			</div>
			<p
				ref={ state }
				className="mt-2 font-mono text-xs text-muted-foreground"
			/>
		</div>
	);
}

/**
 * The thumbnails of a slider: a slider of its own, whose slides are the
 * buttons of the other one.
 */
export function Thumbs( {
	id,
	label,
	of,
	children,
}: {
	id: string;
	label: string;
	/** The slider they are the thumbnails of, once it is made. */
	of: Slider | null;
	children: ReactNode;
} ) {
	const [ root ] = useSlider(
		{ contain: true, plugins: of ? [ thumbs( of ) ] : [] },
		[ of ]
	);
	return (
		<div ref={ root } id={ id } aria-label={ label } className="ss thumbs">
			<div className="ss-track">{ children }</div>
		</div>
	);
}

type SlideProps = {
	/** Number of an image of the site. */
	image?: number;
	/** Name of a video of the site. */
	video?: 'a' | 'b';
	alt: string;
	/** How wide the slide is on the page: what `sizes` of an image says. */
	sizes?: string;
	/** The first thing a visitor sees: loaded before all else. */
	first?: boolean;
	className?: string;
	children?: ReactNode;
};

export function Slide( {
	image: n,
	video: name,
	alt,
	sizes = '100vw',
	first,
	className,
	children,
}: SlideProps ) {
	return (
		<div className={ cn( 'ss-slide', className ) }>
			{ name ? (
				<video
					className="ss-media"
					{ ...video( name ) }
					aria-label={ alt }
					preload="none"
					muted
					playsInline
					loop
					autoPlay
				/>
			) : (
				<img
					className="ss-media"
					{ ...image( n! ) }
					sizes={ sizes }
					alt={ alt }
					draggable={ false }
					decoding="async"
					loading={ first ? 'eager' : 'lazy' }
					fetchPriority={ first ? 'high' : 'auto' }
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
