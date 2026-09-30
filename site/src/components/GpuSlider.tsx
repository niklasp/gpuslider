import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react';
import { type Create, type Options, type Slider } from 'gpuslider';
import { Slider as LibrarySlider, useSlider } from 'gpuslider/react';
import { thumbs } from 'gpuslider/plugins';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

// Classes that do not contradict each other need no merger.
const cn = ( ...classes: ( string | undefined )[] ) =>
	classes.filter( Boolean ).join( ' ' );
import { FILM, film, filmed, image, photo, useKind, video, type Film } from '@/lib/media';

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
	/**
	 * What lies over all slides, and stays where it is while they move:
	 * it lets the pointer through, but for what can be pressed in it.
	 */
	over?: ReactNode;
	/**
	 * The dots, the arrows and the pause in one bar of glass, bottom
	 * right, instead of each at its own place.
	 */
	dock?: boolean;
	/**
	 * Wait for the canvas: a placeholder until it draws, and a move asked
	 * for before is made once it does, with its transition.
	 */
	wait?: boolean;
	children: ReactNode;
};

const button =
	'sq-pill absolute top-1/2 z-10 grid size-11 -translate-y-1/2 cursor-pointer place-items-center bg-black/40 text-white backdrop-blur-md transition hover:bg-black/65 disabled:opacity-20 disabled:cursor-default';

/** A button of the dock: round, and lit under the pointer. */
const KEY =
	'sq-pill grid size-9 cursor-pointer place-items-center text-white/85 transition hover:bg-white/15 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * A slider of the library in React, made with its `<Slider>`: React
 * renders the slides, the library moves them.
 */
export function GpuSlider( {
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
	over,
	dock,
	wait,
	children,
}: Props ) {
	const state = useRef< HTMLParagraphElement >( null );
	// Other pictures are another slider: the canvas has other textures.
	const kind = useKind();
	const [ slider, setSlider ] = useState< Slider | null >( null );
	// The listener of now, for a slider that was made before.
	const hears = useRef( heard );
	hears.current = heard;
	// Every event but the frames, from the one that makes the slider on:
	// `<Slider>` tells a listener of `on` by the name of the event, and
	// this one has a listener for every name.
	const [ every ] = useState(
		() =>
			new Proxy( {} as Record< string, ( detail: unknown ) => void >, {
				get: ( _, name ) => ( detail: unknown ) =>
					name !== 'frame' && hears.current?.( name as string, detail ),
			} )
	);

	useEffect( () => {
		if ( ! slider ) {
			return;
		}
		const names = ( window as unknown as { sliders: Record< string, unknown > } );
		names.sliders = { ...names.sliders, [ id ]: slider };

		// What a frame costs the page: the time the layer takes to say
		// what is to be drawn, and the time from one frame to the next.
		let cost = 0;
		let apart = 0;
		let before = 0;
		const timed = ( name: unknown ) => {
			const layer = slider.plugins[ name as string ];
			const { frame } = layer;
			layer.frame = ( ...all: unknown[] ) => {
				const from = performance.now();
				frame( ...all );
				const now = performance.now();
				cost += ( now - from - cost ) * 0.1;
				if ( before && from - before < 100 ) {
					apart += ( from - before - apart ) * 0.1;
				}
				before = from;
			};
		};
		const off = slider.on( 'canvas:ready', timed );

		const tell = () => {
			if ( state.current ) {
				const { gpu, gl } = slider.plugins;
				const drawing = gpu?.canvas
					? 'WebGPU'
					: gl?.canvas
					? 'WebGL'
					: 'the page';
				state.current.dataset.by = drawing;
				state.current.textContent =
					`${ slider.index + 1 } of ${ slider.count() } · drawn by ${ drawing } · ${ Math.abs(
						slider.view.velocity
					).toFixed( 1 ) } views per second` +
					( gpu?.canvas || gl?.canvas
						? ` · ${ cost.toFixed( 2 ) } ms of script and ${ apart.toFixed(
								1
						  ) } ms from frame to frame`
						: '' );
			}
		};
		tell();
		const quiet = slider.on( 'frame', tell );
		return () => {
			off();
			quiet();
		};
	}, [ slider, id ] );

	// A slider that waits for its canvas: until it draws, the page shows a
	// placeholder, autoplay holds, and a press of an arrow is kept and done
	// once it draws, with the transition. So a move is never a crossfade
	// of the page: not at the start, and not when it comes back into view
	// and makes its canvas again.
	useEffect( () => {
		if ( ! slider || ! wait ) {
			return;
		}
		const { root } = slider;
		let ready = false;
		let held = false;
		let kept = 0;
		const drawn = () => {
			ready = true;
			root.classList.remove( 'gs-waiting' );
			if ( held ) {
				held = false;
				slider.plugins.autoplay?.play();
			}
			for ( ; kept > 0; kept-- ) {
				slider.next();
			}
			for ( ; kept < 0; kept++ ) {
				slider.prev();
			}
		};
		const gone = () => {
			ready = false;
			root.classList.add( 'gs-waiting' );
			if ( slider.plugins.autoplay && ! slider.plugins.autoplay.paused ) {
				held = true;
				slider.plugins.autoplay.pause();
			}
		};
		const press = ( event: MouseEvent ) => {
			const arrow = ( event.target as Element ).closest( '[data-gs-prev], [data-gs-next]' );
			if ( ready || ! arrow ) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			kept += arrow.matches( '[data-gs-next]' ) ? 1 : -1;
		};
		gone();
		root.addEventListener( 'click', press, { capture: true } );
		const offs = [ 'gl:on', 'gpu:on', 'gl:off', 'gpu:off' ].map( ( name ) =>
			slider.on( name, name.endsWith( 'on' ) ? drawn : gone )
		);
		// A browser that has neither: the page moves the slides.
		const late = setTimeout( () => ready || drawn(), 4000 );
		return () => {
			root.removeEventListener( 'click', press, { capture: true } );
			offs.forEach( ( off ) => off() );
			clearTimeout( late );
		};
	}, [ slider, wait ] );

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
			<LibrarySlider
				{ ...options }
				plugins={ plugins() }
				remake={ [ made, kind ] }
				on={ every }
				onSlider={ setSlider }
				id={ id }
				data-made={ made }
				aria-label={ label }
				className={ cn( 'sq-stage', className ) }
				style={ style }
				around={
					<>
						{ /* Until the canvas draws: a light that goes over the first picture. */ }
						{ wait && <span aria-hidden className="shimmer" /> }
						{ over && (
							<div className="over pointer-events-none absolute inset-0 z-10 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_label]:pointer-events-auto">
								{ over }
							</div>
						) }
						{ dock ? (
							<div className="dock sq-pill absolute end-4 bottom-4 z-10 flex items-center gap-1 bg-black/30 p-1 ps-3 text-white ring-1 ring-white/15 backdrop-blur-xl backdrop-saturate-150 md:end-8 md:bottom-8 lg:end-14">
								<div data-gs-dots className="dots flex items-center" />
								<span aria-hidden className="mx-1.5 h-5 w-px bg-white/20" />
								<button
									type="button"
									data-gs-prev
									aria-label="Previous slide"
									className={ KEY }
								>
									<ChevronLeft className="size-[18px]" strokeWidth={ 2.25 } />
								</button>
								<button
									type="button"
									data-gs-next
									aria-label="Next slide"
									className={ KEY }
								>
									<ChevronRight className="size-[18px]" strokeWidth={ 2.25 } />
								</button>
								{ pause && (
									<button
										type="button"
										data-gs-pause
										aria-label="Pause autoplay"
										className={ `${ KEY } group` }
									>
										{ /* What a press does: pause while it plays, play while not. */ }
										<Pause className="size-3.5 fill-current group-aria-pressed:hidden" />
										<Play className="hidden size-3.5 fill-current group-aria-pressed:block" />
									</button>
								) }
							</div>
						) : (
							<>
								{ ! bare && (
									<>
										<button
											type="button"
											data-gs-prev
											aria-label="Previous slide"
											className={ cn( button, 'start-4' ) }
										>
											<ChevronLeft className="size-5" />
										</button>
										<button
											type="button"
											data-gs-next
											aria-label="Next slide"
											className={ cn( button, 'end-4' ) }
										>
											<ChevronRight className="size-5" />
										</button>
									</>
								) }
								{ pause && (
									<button
										type="button"
										data-gs-pause
										aria-label="Pause autoplay"
										className="sq-pill absolute end-4 bottom-4 z-10 grid size-9 cursor-pointer place-items-center bg-black/40 text-white backdrop-blur-md aria-pressed:bg-white aria-pressed:text-black"
									>
										<Pause className="size-3.5" />
									</button>
								) }
								{ ! bare && (
									<div
										data-gs-dots
										className="dots absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2"
									/>
								) }
							</>
						) }
					</>
				}
			>
				{ children }
			</LibrarySlider>
			<p
				ref={ state }
				// As high as what it will say: nothing below it gives way.
				className="mt-3 min-h-12 px-1 font-mono text-xs text-muted-foreground sm:min-h-8 xl:min-h-4"
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
		<div ref={ root } id={ id } aria-label={ label } className="gs thumbs">
			<div className="gs-track">{ children }</div>
		</div>
	);
}

/**
 * The focus points of the pictures, by their numbers: the image of a
 * slide of a picture that has one says it as its own `--gs-focus`.
 */
export const Focus = createContext< Record< number, { x: number; y: number } > >( {} );

type SlideProps = {
	/** Number of an image of the site. */
	image?: number;
	/** Name of a video of the site. */
	video?: Film;
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
	const kind = useKind();
	// A picture in place of a film: only `b` has one.
	const picture = ( n ?? name ) as number | 'a' | 'b';
	const point = useContext( Focus )[ n as number ];
	return (
		<div className={ cn( 'gs-slide', className ) }>
			{ name && filmed( name, kind ) ? (
				<video
					className="gs-media"
					{ ...video( name ) }
					aria-label={ name === 'a' ? FILM : alt }
					preload="none"
					muted
					playsInline
					loop
					ref={ film }
				/>
			) : (
				<img
					className="gs-media"
					{ ...image( picture, kind ) }
					// Its focus point, where one is set: over the one it has.
					{ ...( point && {
						style: { '--gs-focus': `${ point.x }% ${ point.y }%` } as CSSProperties,
					} ) }
					sizes={ sizes }
					alt={ kind === 'photos' ? photo( picture ).alt : alt }
					draggable={ false }
					decoding="async"
					loading={ first ? 'eager' : 'lazy' }
					fetchPriority={ first ? 'high' : 'auto' }
				/>
			) }
			{ children && (
				<div className="gs-content flex flex-col justify-end gap-1.5 bg-gradient-to-b from-transparent from-45% to-black/65 p-6 pb-14 text-white md:p-12 md:pb-16">
					{ children }
				</div>
			) }
		</div>
	);
}
