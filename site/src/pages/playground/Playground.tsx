import {
	lazy,
	Suspense,
	useCallback,
	useRef,
	useState,
	type CSSProperties,
} from 'react';
import '@/index.css';
import 'gpuslider/style.css';
import 'gpuslider/lightbox.css';
import 'gpuslider/loading.css';
import '@/site.css';
// The controls are most of the script of the page, and no slider waits
// for them.
const Controls = lazy( () => import( '@/components/Controls' ) );
import { GpuSlider, Slide } from '@/components/GpuSlider';
import { Events, Loads, Photos, type Tell } from '@/components/Pieces';
import {
	DEFAULTS,
	keyOf,
	pluginsOf,
	single,
	type Config,
} from '@/lib/config';
import { BUTTON, Footer, Nav, Section } from '@/components/Frame';
import { EXAMPLES } from '@/components/Shots';
import { kb, parts } from '@/lib/metrics';

/** A link of the page, as the pills of the first page. */
const PILL =
	'sq-pill inline-flex h-10 items-center px-4 text-sm font-medium ring-1 ring-white/10 transition';

/**
 * How wide a slide that fills the page is: the screen less the controls
 * beside it and the room of the page, and at most 1400px less that room.
 */
const WIDE =
	'(min-width: 1024px) min(1336px, calc(100vw - 388px)), (min-width: 768px) calc(100vw - 140px), calc(100vw - 100px)';

/**
 * Every slider the library can be, with controls for all of it.
 */
export default function Playground() {
	const [ config, setConfig ] = useState< Config >( DEFAULTS );
	const change = useCallback(
		( part: Partial< Config > ) =>
			setConfig( ( now ) => ( { ...now, ...part } ) ),
		[]
	);

	const made = keyOf( config );
	// How wide a slide of several is, for the browser that picks the file.
	const share = `(max-width: 640px) 77vw, ${ Math.round(
		100 / config.perView
	) }vw`;
	const focus = `${ config.focus.x }% ${ config.focus.y }%`;
	const measured = `${ config.perView } ${ config.gap } ${ focus }`;
	const look = { '--gs-focus': focus } as CSSProperties;
	const options = {
		loop: config.loop,
		free: config.free,
		duration: config.duration,
	};
	const shared = { made, measured, plugins: () => pluginsOf( config ) };

	// With a random transition the sliders that take it are made again
	// once a slide has arrived, for another, and go on from that slide.
	const [ rolls, setRolls ] = useState< Record< string, number > >( {} );
	const at = useRef< Record< string, number > >( {} );
	// A slider that is made settles at once: another only after a move.
	const moved = useRef< Record< string, boolean > >( {} );
	const rolling = config.transition === 'random';
	const rolled = ( id: string ) => ( {
		made: rolling ? `${ made } ${ rolls[ id ] || 0 }` : made,
		heard: ( name: string, detail: unknown ) => {
			if ( name === 'change' ) {
				at.current[ id ] = detail as number;
				moved.current[ id ] = true;
			} else if ( name === 'settle' && rolling && moved.current[ id ] ) {
				moved.current[ id ] = false;
				setRolls( ( now ) => ( { ...now, [ id ]: ( now[ id ] || 0 ) + 1 } ) );
			}
		},
	} );
	// The sliders that show one slide at a time take the transition.
	// That they are stacks is in the HTML: nothing gives way when the
	// script comes.
	const one = {
		className: single( config ) === 'stack' ? 'gs-stack' : undefined,
		made,
		measured,
		plugins: () => pluginsOf( config, single( config ) ),
		options:
			single( config ) === 'stack'
				? { ...options, duration: Math.max( 900, config.duration * 1.8 ) }
				: options,
	};

	// What the slider with the buttons outside of it said last.
	const tell: Tell = useRef( null );
	const heard = useCallback( ( name: string, detail: unknown ) => {
		const said =
			typeof detail === 'number' || typeof detail === 'boolean'
				? ` ${ detail }`
				: Array.isArray( detail ) && typeof detail[ 0 ] === 'number'
				? ` ${ detail.join( ', ' ) }`
				: '';
		tell.current?.( `${ name }${ said }` );
	}, [] );

	return (
		<>
			<Nav at="playground" />
			<div className="flex items-start">
			<Suspense
				fallback={ <div className="w-[4.25rem] shrink-0 md:w-[4.75rem] lg:w-[324px]" /> }
			>
				<Controls config={ config } onChange={ change } />
			</Suspense>
			<main
				id="top"
				className="mx-auto grid max-w-[1400px] min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-24 px-4 pb-32 md:px-8"
			>
				<div className="grid justify-items-start gap-5 pt-16 md:pt-24">
					<h1 className="font-display text-5xl leading-[0.95] font-semibold tracking-[-0.045em] md:text-7xl">
						Playground
					</h1>
					<p className="max-w-2xl text-lg text-balance text-muted-foreground">
						Every slider the library can be, and the settings for all of
						it beside them. Drag, swipe, scroll sideways, use the arrow
						keys. Click a slide for the lightbox.
					</p>
					<nav
						aria-label="Pages that are made of it"
						className="flex flex-wrap items-center gap-2"
					>
						{ EXAMPLES.map( ( { name, title } ) => (
							<a key={ name } className={ `${ PILL } bg-white/6 hover:bg-white/12` } href={ `/examples/${ name }/` }>
								{ title }
							</a>
						) ) }
						<a className={ `${ PILL } bg-white text-black hover:bg-white/85` } href="/docs/">
							Docs
						</a>
					</nav>
				</div>

				<Section
					title="One per view"
					note="Images and a video. The text is HTML on top of the canvas. One slide at a time takes the transition that is chosen in the settings, or another every time: drag slowly to stop half way. With none, the slides move."
				>
					<GpuSlider
						id="one"
						label="One per view"
						style={ look }
						pause={ config.autoplay }
						{ ...one }
						{ ...rolled( 'one' ) }
						options={ { ...one.options, start: at.current.one } }
					>
						<Slide image={ 1 } alt="Warm colour field" className="hero" sizes={ WIDE } first>
							<h3 className="text-2xl font-semibold md:text-4xl">Own motion</h3>
							<p className="text-white/80">
								A spring, solved exactly on every frame.
							</p>
						</Slide>
						<Slide video="a" alt="Moving colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">Video</h3>
							<p className="text-white/80">
								Plays while its slide is in view, with the same effects.
							</p>
						</Slide>
						<Slide image={ 2 } alt="Blue colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">
								No dependency
							</h3>
							<p className="text-white/80">
								The core is { kb( parts.core ) } KB. All else is asked
								for.
							</p>
						</Slide>
						<Slide image={ 4 } alt="Pink colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">Idle is free</h3>
							<p className="text-white/80">
								No frame is drawn while nothing moves.
							</p>
						</Slide>
					</GpuSlider>
				</Section>

				<Section
					title="Videos"
					note={ 'A film is a slide as a picture is: the canvas draws each new frame of it, with the effects that are chosen. It plays while its slide is in view and stops when it leaves, and one that says preload="none" is loaded when it comes.' }
				>
					<GpuSlider
						id="films"
						label="Videos"
						options={ options }
						className="cards"
						style={
							{
								...look,
								'--gs-per-view': 2,
								'--gs-gap': `${ config.gap }px`,
							} as CSSProperties
						}
						{ ...shared }
					>
						<Slide video="a" alt="" className="card wide" sizes={ share } />
						<Slide video="c" alt="Colour field that moves" className="card wide" sizes={ share } />
						<Slide video="b" always alt="Colour field that moves" className="card wide" sizes={ share } />
					</GpuSlider>
				</Section>

				<Section
					title="Several per view"
					note="Slides per view and gap are CSS custom properties: set them under Slider."
				>
					<GpuSlider
						id="several"
						label="Several per view"
						options={ options }
						className="cards"
						style={
							{
								...look,
								'--gs-per-view': config.perView,
								'--gs-gap': `${ config.gap }px`,
							} as CSSProperties
						}
						{ ...shared }
					>
						{ [ 1, 2, 3, 4, 5, 6, 7, 8 ].map( ( n ) => (
							<Slide
								key={ n }
								image={ n }
								alt={ `Colour field ${ n }` }
								className="card"
								sizes={ share }
							/>
						) ) }
					</GpuSlider>
				</Section>

				<Section
					title="Ticker"
					note="Runs by itself and without an end, slower under the pointer. Scroll the page: it runs faster, and the images give way to the speed. Drag it, and it runs on."
				>
					<GpuSlider
						id="ticker"
						label="Ticker"
						options={ { loop: true, free: true, duration: config.duration } }
						className="cards"
						style={
							{
								...look,
								'--gs-per-view': 4.5,
								'--gs-gap': `${ config.gap }px`,
							} as CSSProperties
						}
						made={ made }
						measured={ measured }
						plugins={ () => pluginsOf( config, 'ticker' ) }
						pause
						bare
					>
						{ [ 8, 6, 4, 2, 7, 5, 3, 1 ].map( ( n ) => (
							<Slide
								key={ n }
								image={ n }
								alt={ `Colour field ${ n }` }
								className="card"
								sizes="(max-width: 640px) 77vw, 22vw"
							/>
						) ) }
					</GpuSlider>
				</Section>

				<Section
					title="With thumbnails"
					note="Two sliders: the slides of the small one are the buttons of the large one."
				>
					<Photos style={ look } { ...one } />
				</Section>

				<Section
					title="Downwards, and in rows"
					note="The same slider with its slides below each other, the one that is shown in the middle: it runs by itself, and can be dragged up and down, or moved with the keys. And two rows, which are a grid of CSS and nothing of the script."
				>
					<div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
						<GpuSlider
							id="down"
							label="Downwards"
							options={ { ...options, axis: 'y', align: 'center', loop: true } }
							className="down"
							style={ { ...look, '--gs-gap': `${ config.gap }px` } as CSSProperties }
							made={ made }
							measured={ measured }
							plugins={ () => pluginsOf( config, 'down' ) }
							pause
						>
							{ [ 6, 1, 4, 7, 2 ].map( ( n ) => (
								<Slide
									key={ n }
									image={ n }
									alt={ `Colour field ${ n }` }
									sizes="(min-width: 768px) 40vw, 100vw"
								/>
							) ) }
						</GpuSlider>
						<GpuSlider
							id="rows"
							label="Two rows"
							options={ options }
							className="rows"
							style={ { ...look, '--gs-gap': `${ config.gap }px` } as CSSProperties }
							{ ...shared }
						>
							{ [ 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4 ].map( ( n, i ) => (
								<Slide
									key={ i }
									image={ n }
									alt={ `Colour field ${ n }` }
									sizes="(min-width: 768px) 20vw, 50vw"
								/>
							) ) }
						</GpuSlider>
					</div>
				</Section>

				<Section
					title="A fan"
					note="A layout that is an effect of the canvas: the slider moves as ever, the effect says where a slide is drawn. Without the canvas it is a row."
				>
					<GpuSlider
						id="fan"
						label="A fan"
						options={ { ...options, align: 'center' } }
						className="laid wide"
						style={ look }
						made={ made }
						measured={ measured }
						plugins={ () => pluginsOf( config, 'fan' ) }
					>
						{ [ 2, 4, 6, 8, 1, 3, 5, 7 ].map( ( n ) => (
							<Slide
								key={ n }
								image={ n }
								alt={ `Colour field ${ n }` }
								className="cover"
								sizes="(max-width: 640px) 60vw, 25vw"
							/>
						) ) }
					</GpuSlider>
				</Section>

				<Section
					title="As wide as the image"
					note="Every slide takes the width of its image."
				>
					<GpuSlider
						id="auto"
						label="Widths from the images"
						options={ { ...options, perView: 'auto', align: 'center' } }
						className="strip"
						style={ { ...look, '--gs-gap': `${ config.gap }px` } as CSSProperties }
						{ ...shared }
					>
						{ [
							[ 3, 1200, 1600 ],
							[ 1, 1600, 900 ],
							[ 5, 1400, 1400 ],
							[ 7, 1600, 700 ],
							[ 8, 1200, 1500 ],
							[ 2, 1600, 1200 ],
						].map( ( [ n ] ) => (
							<Slide
								key={ n }
								image={ n }
								alt={ `Colour field ${ n }` }
								sizes="(max-width: 640px) 90vw, 50vw"
							/>
						) ) }
					</GpuSlider>
				</Section>

				<Section
					title="As high as the slide"
					note="The height follows the move, and the page below follows the height."
				>
					<div className="max-w-2xl">
						<GpuSlider
							id="tall"
							label="Auto height"
							options={ options }
							style={ look }
							made={ made }
							measured={ measured }
							plugins={ () => pluginsOf( config, 'tall' ) }
						>
							{ [
								[ 7, 1600, 700 ],
								[ 5, 1400, 1400 ],
								[ 1, 1600, 900 ],
								[ 3, 1200, 1600 ],
							].map( ( [ n ] ) => (
								<Slide
									key={ n }
									image={ n }
									alt={ `Colour field ${ n }` }
									sizes="(min-width: 700px) 672px, 100vw"
								/>
							) ) }
						</GpuSlider>
					</div>
				</Section>

				<Section
					title="Stack"
					note="Slides on top of each other. The position runs through a transition: drag slowly to stop half way."
				>
					<GpuSlider
						id="stack"
						label="Stack"
						className="gs-stack"
						options={ {
							...options,
							duration: Math.max( 900, config.duration * 1.8 ),
							start: at.current.stack,
						} }
						style={ look }
						pause={ config.autoplay }
						{ ...rolled( 'stack' ) }
						measured={ measured }
						plugins={ () => pluginsOf( config, 'stack' ) }
					>
						<Slide image={ 6 } alt="Violet colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">
								On top of each other
							</h3>
							<p className="text-white/80">Twenty transitions to choose from.</p>
						</Slide>
						<Slide image={ 4 } alt="Pink colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">
								Follows the pointer
							</h3>
							<p className="text-white/80">Stop half way, go back.</p>
						</Slide>
						<Slide video="b" alt="Moving colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">Video too</h3>
							<p className="text-white/80">A transition into a playing video.</p>
						</Slide>
						<Slide image={ 2 } alt="Blue colour field" className="hero" sizes={ WIDE }>
							<h3 className="text-2xl font-semibold md:text-4xl">
								A crossfade without WebGL
							</h3>
							<p className="text-white/80">Switch the canvas off to see it.</p>
						</Slide>
					</GpuSlider>
				</Section>

				<Section
					title="Covers"
					note="An animation as a plugin. On the canvas it is an effect that turns the mesh; with the canvas off, the progress plugin tells the slides where they are and CSS turns them."
				>
					<GpuSlider
						id="covers"
						label="Covers"
						options={ { ...options, align: 'center' } }
						className="covers"
						style={ look }
						made={ made }
						measured={ measured }
						plugins={ () => pluginsOf( config, 'covers' ) }
					>
						{ [ 5, 6, 7, 8, 1, 2, 3 ].map( ( n ) => (
							<Slide
								key={ n }
								image={ n }
								alt={ `Colour field ${ n }` }
								className="cover"
								sizes="(max-width: 640px) 62vw, 33vw"
							/>
						) ) }
					</GpuSlider>
				</Section>

				<Section
					title="Loading"
					note="A screen while the pictures load, and events that say how far they are. The screen is the one of the library; any element of the page can be it."
				>
					<Loads
						options={ options }
						style={
							{
								...look,
								'--gs-per-view': 2.5,
								'--gs-gap': '12px',
							} as CSSProperties
						}
						made={ made }
						measured={ measured }
						plugins={ shared.plugins }
					/>
				</Section>

				<Section
					title="Buttons anywhere, and events"
					note="The buttons are not in the slider: they name it with data-gs-for. The list is what the slider says while it is used."
				>
					<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
						<GpuSlider
							id="remote"
							label="Driven from outside"
							options={ options }
							className="cards"
							style={
								{
									...look,
									'--gs-per-view': 2,
									'--gs-gap': `${ config.gap }px`,
								} as CSSProperties
							}
							heard={ heard }
							bare
							{ ...shared }
						>
							{ [ 2, 4, 6, 8, 1, 3 ].map( ( n ) => (
								<Slide
									key={ n }
									image={ n }
									alt={ `Colour field ${ n }` }
									className="card wide"
									sizes="(min-width: 768px) 40vw, 50vw"
								/>
							) ) }
						</GpuSlider>
						<div className="grid content-start gap-4">
							<nav
								data-gs-for="remote"
								data-testid="remote-buttons"
								aria-label="Driven from outside"
								className="flex flex-wrap gap-2"
							>
								<button type="button" className={ BUTTON } data-gs-prev>
									Back
								</button>
								<button type="button" className={ BUTTON } data-gs-next>
									On
								</button>
								{ [ 0, 2, 4 ].map( ( n ) => (
									<button
										key={ n }
										type="button"
										className={ BUTTON }
										data-gs-to={ n }
									>
										{ n + 1 }
									</button>
								) ) }
							</nav>
							<Events tell={ tell } />
						</div>
					</div>
				</Section>
			</main>
			</div>
			<Footer />
		</>
	);
}
