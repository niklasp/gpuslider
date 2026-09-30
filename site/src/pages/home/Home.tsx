import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react';
import '@/index.css';
import 'gpuslider/style.css';
import '@/site.css';
import '@/text.css';
import './home.css';
import { code } from 'virtual:docs';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import type { Slider } from 'gpuslider';
import {
	BUTTON,
	Code,
	Footer,
	Nav,
	SECOND,
	Section,
} from '@/components/Frame';
import { Shots } from '@/components/Shots';
import {
	autoplay,
	controls,
	keyboard,
	stack,
	videos,
	wheel,
} from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { lightbox } from 'gpuslider/lightbox';
import 'gpuslider/lightbox.css';
import {
	burn,
	dome,
	cells,
	parallax,
	shift,
	glitch,
	liquid,
	mosaic,
	push,
	split,
	stretch,
	swirl,
	warp,
	wind,
	distance,
	zoom,
} from 'gpuslider/effects';
import {
	asked,
	bench,
	count,
	files,
	kb,
	lighthouse,
	parts,
	range,
	type Layer,
} from '@/lib/metrics';
import { layer } from '../mount';
import { LIGHT, calm, lightOf, useKind } from '@/lib/media';
import {
	ArrowsOut,
	Atom,
	BracketsAngle,
	Cpu,
	MagicWand,
	PuzzlePiece,
	Shuffle,
	Spiral,
} from '@/components/icons';
import type { Icon } from '@/components/icons';

/** What a slide of the stage says: small, beside what the page says. */
const SAID = 'font-display text-lg font-semibold tracking-[-0.02em]';
const SAYS = 'max-w-64 text-sm text-white/70';

/** The colours of the pictures, one for each card in turn. */
const TINTS = [ 1, 2, 5, 4, 6, 3, 8, 7 ].map( ( n ) => LIGHT[ n ] );

const [ chromium, webkit ] = bench.browsers;
const ms = ( time: number ) => `${ Math.round( time ) } ms`;

/** A number of the library, and what it is the number of. */
function Figure( {
	value,
	unit,
	children,
}: {
	value: string | number;
	unit?: string;
	children: ReactNode;
} ) {
	return (
		<li className="grid content-start justify-items-center gap-2 text-center">
			<span className="font-display text-5xl font-semibold tracking-[-0.04em] tabular-nums md:text-6xl">
				{ value }
				{ unit && (
					<span className="ml-1.5 text-lg tracking-normal text-muted-foreground">
						{ unit }
					</span>
				) }
			</span>
			<span className="max-w-60 text-sm text-muted-foreground">{ children }</span>
		</li>
	);
}

const FEATURES: {
	title: string;
	text: string;
	to: string;
	more: string;
	icon: Icon;
}[] = [
	{
		title: 'Its own motion',
		text: 'A spring, solved exactly on every frame. Drag, swipe, the wheel, the keys. It snaps, loops, rests anywhere, goes sideways or downwards.',
		to: '/docs/options/',
		more: 'Options, API and events',
		icon: Spiral,
	},
	{
		title: 'WebGPU first',
		text: 'The canvas asks the browser and loads one layer: WebGPU where it is, WebGL 2 where not. Both draw the same picture, and the tests hold them against each other, effect by effect.',
		to: '/docs/canvas/',
		more: 'The canvas',
		icon: Cpu,
	},
	{
		title: `${ count( 'effect' ) } effects, written once`,
		text: 'Images that give way to the speed, colours that come apart, lenses and waves under the pointer, slides of jelly and of thick glass. An effect is a few lines of GLSL, and is translated for WebGPU when the shader is made.',
		to: '/docs/effects/',
		more: 'Effects',
		icon: MagicWand,
	},
	{
		title: `${ count( 'transition' ) } transitions`,
		text: 'One slide turns into the next: liquid, burn, glitch, fold. They follow the pointer, so a slow drag stops half way. What is written for gl-transitions runs as it is.',
		to: '/docs/effects/',
		more: 'Transitions',
		icon: Shuffle,
	},
	{
		title: 'Everything is a plugin',
		text: 'Arrows, dots, keys, autoplay, a ticker, thumbnails, videos that play in view. What is not imported is not in the bundle, and a plugin of your own is a function.',
		to: '/docs/plugins/',
		more: 'Plugins',
		icon: PuzzlePiece,
	},
	{
		title: 'A lightbox',
		text: 'A click lets the image grow out of its slide to the screen, and one canvas draws all of it: the one of the slider, with its effects, which fade on the way. Drag it there, or the arrows; Escape lets it go back into its slide.',
		to: '/docs/lightbox/',
		more: 'Lightbox',
		icon: ArrowsOut,
	},
	{
		title: 'React',
		text: `<Slider> and <Slide>, ${ parts[ 'react: what <Slider> and <Slide> add' ] } bytes on the core. Options are props, React renders the slides, the library moves them, and slides that come and go are seen.`,
		to: '/docs/react/',
		more: 'React',
		icon: Atom,
	},
	{
		title: 'No script of your own',
		text: `One file of ${ kb( files[ 'auto.js' ] ) } KB and attributes in the HTML. The canvas and the lightbox are loaded when a slider asks for them and the page has time.`,
		to: '/docs/html/',
		more: 'Without a script',
		icon: BracketsAngle,
	},
];

/** The transitions that can be chosen here. The docs have all of them. */
const TRANSITIONS = { liquid, push, warp, zoom, burn, glitch, swirl, mosaic, wind, distance };

/**
 * How a transition goes: quick away, slowing down, and done in its time,
 * without the long end of a spring.
 */
const SNAP = ( u: number ) => 1 - ( 1 - u ) ** 4;

/** The time of a transition, ms: from the fastest to the slowest. */
const FASTEST = 600;
const SLOWEST = 3000;

type Name = keyof typeof TRANSITIONS;

const WAYS = {
	script: 'What you name',
	canvas: 'With the canvas',
	react: 'React',
	html: 'No script of your own',
} as const;

/** The ways to use it, as the README has them. */
function Ways() {
	const [ way, setWay ] = useState< keyof typeof WAYS >( 'script' );
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-3">
			<div role="tablist" aria-label="Ways to use it" className="flex flex-wrap justify-center gap-2">
				{ ( Object.keys( WAYS ) as ( keyof typeof WAYS )[] ).map( ( one ) => (
					<button
						key={ one }
						type="button"
						role="tab"
						id={ `way-${ one }` }
						aria-selected={ one === way }
						aria-controls="way"
						aria-current={ one === way ? 'true' : undefined }
						className={ BUTTON }
						onClick={ () => setWay( one ) }
					>
						{ WAYS[ one ] }
					</button>
				) ) }
			</div>
			<div id="way" role="tabpanel" aria-labelledby={ `way-${ way }` }>
				<Code html={ code[ way ] } label={ WAYS[ way ] } />
			</div>
		</div>
	);
}

/** What the parts weigh, as bars: the longest is the largest. */
function Sizes() {
	const rows: [ string, number, string? ][] = [
		[ 'The core', parts.core ],
		[ 'The core with all its options', parts[ 'full: the slider with all its options' ] ],
		[ 'useSlider, for React', parts[ 'react: what useSlider adds' ] ],
		[ 'canvas(), which chooses the layer', parts[ 'canvas: what chooses the layer' ] ],
		[ 'The layer of WebGPU', parts[ 'canvas layer of WebGPU, no effects' ] ],
		[ 'The layer of WebGL 2', parts[ 'canvas layer, no effects' ] ],
		[ 'The lightbox', parts.lightbox ],
		[ 'auto.js, for pages without a script of their own', files[ 'auto.js' ] ],
	];
	const most = Math.max( ...rows.map( ( [ , size ] ) => size ) );
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<ul data-testid="sizes" className="grid gap-2.5">
				{ rows.map( ( [ name, size ] ) => (
					<li key={ name } className="grid gap-1">
						<span className="flex justify-between gap-4 text-sm">
							<span>{ name }</span>
							<span className="font-mono text-muted-foreground tabular-nums">
								{ kb( size ) } KB
							</span>
						</span>
						<span
							className="bar"
							style={ { '--share': size / most } as CSSProperties }
						/>
					</li>
				) ) }
			</ul>
			<ul className="grid content-start gap-3 text-sm text-muted-foreground">
				<li>
					<strong className="font-medium text-foreground">
						A plugin is { range( 'plugin' ) } KB
					</strong>
					, an effect { range( 'effect' ) }, a transition{ ' ' }
					{ range( 'transition' ) }.
				</li>
				<li>
					<strong className="font-medium text-foreground">
						A visitor loads one of the two layers
					</strong>
					, and loads it when a slider is used or the page has time.
				</li>
				<li>
					<strong className="font-medium text-foreground">
						Gzipped, in the bundle of who imports it.
					</strong>{ ' ' }
					Every part has a budget, and the build fails over it.{ ' ' }
					<a className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground" href="/docs/size/">
						All sizes
					</a>
				</li>
			</ul>
		</div>
	);
}

/** The two layers, measured against each other. */
function Measured() {
	const both = ( say: ( browser: typeof chromium, layer: Layer ) => string ) =>
		( [ 'gl', 'gpu' ] as Layer[] ).map( ( name ) => (
			<td key={ name }>
				<span className="block">{ say( chromium, name ) }</span>
				<span className="block text-muted-foreground">
					{ say( webkit, name ) }
				</span>
			</td>
		) );
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-3">
			<div className="scrolls" tabIndex={ 0 } role="group" aria-label="What was measured">
				<table data-testid="measured">
					<thead>
						<tr>
							<th />
							<th>WebGL 2</th>
							<th>WebGPU</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<th>The first slider of a page is drawn after</th>
							{ both( ( browser, name ) => ms( browser.until( name ).first ) ) }
						</tr>
						<tr>
							<th>A slider after it</th>
							{ both( ( browser, name ) => ms( browser.until( name ).second ) ) }
						</tr>
						<tr>
							<th>Four more, made together</th>
							{ both( ( browser, name ) =>
								ms( browser.moving( name, 6 ).rest || 0 )
							) }
						</tr>
						<tr>
							<th>Of 20 sliders on a page, the canvas draws</th>
							{ both( ( browser, name ) =>
								String( browser.moving( name, 20 ).canvases )
							) }
						</tr>
						<tr>
							<th>Script in a frame while 6 sliders move</th>
							{ both(
								( browser, name ) =>
									`${ browser.moving( name, 6 ).script.toFixed( 2 ) } ms`
							) }
						</tr>
						<tr>
							<th>Frames that came late while 20 sliders moved for 4 s</th>
							{ both( ( browser, name ) => {
								const { late, frames } = browser.moving( name, 20 );
								return `${ late } of ${ frames }`;
							} ) }
						</tr>
						<tr>
							<th>The layer in the bundle</th>
							<td>{ kb( parts[ 'canvas layer, no effects' ] ) } KB</td>
							<td>{ kb( parts[ 'canvas layer of WebGPU, no effects' ] ) } KB</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="max-w-3xl text-sm text-muted-foreground">
				In { chromium.name } { chromium.version }
				<span> · { webkit.name } { webkit.version }</span>, both without a
				window, on { bench.machine } with { bench.density } device pixels
				per pixel, { bench.date }. Sliders with two effects. The first two
				lines are the middle of { bench.runs } runs. WebGPU has one device
				for all sliders of a page, and a shader is made once for all of
				them: so the second slider is there in two frames, and a page has
				as many sliders on the canvas as it likes. While they move there is
				no difference to see.{ ' ' }
				<a
					className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
					href="/docs/canvas/#webgpu-and-webgl-measured"
				>
					What it says, and what it does not
				</a>
			</p>
		</div>
	);
}

/** What Lighthouse gives a score for, as it names it. */
const AUDITS = [
	[ 'performance', 'Performance' ],
	[ 'accessibility', 'Accessibility' ],
	[ 'best-practices', 'Best practices' ],
	[ 'seo', 'SEO' ],
	[ 'agentic-browsing', 'Agentic browsing' ],
] as const;

const DEVICES = { mobile: 'Phone', desktop: 'Desktop' } as const;

/** How a ring fills: fast, and slowing to its score. */
const FILL = ( u: number ) => 1 - ( 1 - u ) ** 3;

/**
 * The scores Lighthouse gave this page, as rings that fill and numbers
 * that count up once they are in view, one after the other. The page
 * that is built has them as they are: for search, for readers of the
 * screen, and without motion.
 */
function Scores( { scores }: { scores: NonNullable< ReturnType< typeof lighthouse > > } ) {
	const [ device, setDevice ] = useState< keyof typeof DEVICES >( 'mobile' );
	const target = AUDITS.map( ( [ key ] ) => scores[ device ][ key ] ?? 0 );
	const [ shown, setShown ] = useState( target );
	const list = useRef< HTMLUListElement >( null );
	const now = useRef( target );
	const seen = useRef( false );
	const frame = useRef( 0 );

	// From what is shown to the scores, each ring a little after the last.
	const go = useCallback( ( to: number[] ) => {
		cancelAnimationFrame( frame.current );
		const from = now.current.slice();
		const start = performance.now();
		const step = ( time: number ) => {
			const at = to.map( ( value, i ) => {
				const u = Math.min( 1, Math.max( 0, ( time - start - i * 140 ) / 1800 ) );
				return from[ i ] + ( value - from[ i ] ) * FILL( u );
			} );
			now.current = at;
			setShown( at );
			if ( at.some( ( value, i ) => value !== to[ i ] ) ) {
				frame.current = requestAnimationFrame( step );
			}
		};
		frame.current = requestAnimationFrame( step );
	}, [] );

	const key = target.join();
	useEffect( () => {
		const el = list.current;
		if ( ! el || matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
			now.current = target;
			setShown( target );
			return;
		}
		if ( seen.current ) {
			go( target );
			return;
		}
		// Empty until they are seen.
		now.current = target.map( () => 0 );
		setShown( now.current );
		const watch = new IntersectionObserver(
			( [ entry ] ) => {
				if ( entry.isIntersecting ) {
					seen.current = true;
					watch.disconnect();
					go( target );
				}
			},
			{ threshold: 0.5 }
		);
		watch.observe( el );
		return () => {
			watch.disconnect();
			cancelAnimationFrame( frame.current );
		};
		// The scores of the device chosen.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ key, go ] );

	return (
		<div className="grid justify-items-center gap-10">
			<div role="group" aria-label="Measured on" className="flex gap-2">
				{ ( Object.keys( DEVICES ) as ( keyof typeof DEVICES )[] ).map( ( one ) => (
					<button
						key={ one }
						type="button"
						className={ BUTTON }
						aria-pressed={ one === device }
						aria-current={ one === device ? 'true' : undefined }
						onClick={ () => setDevice( one ) }
					>
						{ DEVICES[ one ] }
					</button>
				) ) }
			</div>
			<ul
				ref={ list }
				data-testid="scores"
				className="flex w-full flex-wrap justify-center gap-x-6 gap-y-10 md:justify-between"
			>
				{ AUDITS.map( ( [ key, name ], i ) => {
					const value = shown[ i ];
					const score = target[ i ];
					return (
						<li
							key={ key }
							className="gauge"
							data-grade={ score >= 90 ? 'good' : score >= 50 ? 'fair' : 'poor' }
						>
							<span className="dial">
								<svg viewBox="0 0 100 100" aria-hidden>
									<circle cx="50" cy="50" r="44" pathLength={ 100 } />
									<circle
										cx="50"
										cy="50"
										r="44"
										pathLength={ 100 }
										style={ { strokeDashoffset: 100 - value } }
									/>
								</svg>
								<span aria-hidden className="value">
									{ Math.round( value ) }
								</span>
							</span>
							<span aria-hidden className="name">
								{ name }
							</span>
							<span className="sr-only">
								{ name }: { score } of 100
							</span>
						</li>
					);
				} ) }
			</ul>
		</div>
	);
}

/**
 * Light in the colours of the pictures, that drifts behind what is laid
 * over it: fields of colour, blurred, each on its own slow way.
 */
function Field() {
	const kind = useKind();
	return (
		<div aria-hidden className="blobs">
			{ [ 1, 6, 4, 2, 5 ].map( ( n ) => (
				<span key={ n } style={ { '--tint': lightOf( n, kind ) } as CSSProperties } />
			) ) }
		</div>
	);
}

/** What the slides at the top show, in their order. */
const FIRST_SLIDES = [ 1, 'a', 2, 4 ] as const;

/**
 * The slider at the top, as large as the window: a stack that goes on by
 * itself, with the transition that is chosen on it. The page around it is
 * lit in the colour of the slide that is seen, and the dot of that slide
 * fills while its time runs.
 */
function Stage() {
	const [ name, setName ] = useState< Name >( 'liquid' );
	const drawn = name;
	// The white pill under the one that is chosen, moved to it.
	const pills = useRef< HTMLDivElement >( null );
	const [ mark, setMark ] = useState< { left: number; width: number } | null >( null );
	useLayoutEffect( () => {
		const on = pills.current?.querySelector< HTMLElement >( '[aria-current]' );
		if ( on ) {
			setMark( { left: on.offsetLeft, width: on.offsetWidth } );
			// Into view in the row, and the page left where it is.
			const row = pills.current!;
			if ( on.offsetLeft < row.scrollLeft || on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth ) {
				row.scrollTo( { left: on.offsetLeft - 48, behavior: 'smooth' } );
			}
		}
	}, [ name ] );
	const [ index, setIndex ] = useState( 0 );
	// Where it is and when the time of its slide ends: a slider made
	// again for another transition goes on from there.
	const at = useRef( { index: 0, ends: 0 } );
	// The time of a move, changed on the slider that there is.
	const [ time, setTime ] = useState( 900 );
	const slider = useRef< Slider | null >( null );
	const kind = useKind();
	const heard = useCallback( ( event: string, detail: unknown ) => {
		const root = document.getElementById( 'first' );
		if ( event === 'change' ) {
			at.current.index = detail as number;
			setIndex( detail as number );
		} else if ( root && event === 'autoplay:run' ) {
			const { delay, left } = detail as { delay: number; left: number };
			at.current.ends = performance.now() + left;
			root.style.setProperty( '--run', `${ delay }ms` );
			root.style.setProperty( '--ran', `${ delay - left }ms` );
			// Again from where it is: a class taken away and given again.
			root.classList.remove( 'running' );
			void root.offsetWidth;
			root.classList.add( 'running' );
		} else if ( root && event === 'autoplay:wait' ) {
			root.classList.remove( 'running' );
		}
	}, [] );
	// Asked while the slider is made: what is left of the time of now.
	const left = () =>
		at.current.ends
			? Math.max( 0, at.current.ends - performance.now() )
			: undefined;
	return (
		<div
			className="lit px-3 pt-[4.5rem] md:px-5"
			style={ { '--light': lightOf( FIRST_SLIDES[ index ], kind ) } as CSSProperties }
		>
			<GpuSlider
				id="first"
				label="What the slider is"
				// Said in the HTML: a stack before the script is there.
				className="stage gs-stack"
				options={ { loop: true, duration: time, ease: SNAP, start: at.current.index } }
				onSlider={ ( made ) => ( slider.current = made ) }
				made={ drawn }
				measured=""
				pause
				dock
				wait
				heard={ heard }
				plugins={ () => [
					controls(),
					keyboard(),
					videos(),
					stack(),
					// The pointer is always over it: it goes on all the same.
					autoplay( { delay: 4000, hover: false, left: left() } ),
					calm(),
					canvas( {
						effects: [ TRANSITIONS[ drawn ]() ],
						layer: layer(),
						// Drawn before the first move: the slides go on by
						// themselves, and every transition is another slider.
						eager: true,
					} ),
				] }
				over={
					<div className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)] justify-items-start gap-5 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-6 pt-40 pb-24 md:gap-6 md:px-14 lg:pe-72 lg:pb-8">
						<h1 className="glow max-w-[13ch] font-display text-5xl leading-[0.95] font-semibold tracking-[-0.045em] text-balance text-white sm:text-7xl xl:text-8xl">
							A slider drawn by shaders.
						</h1>
						<p className="max-w-md text-white/75 md:text-lg">
							By WebGPU, or by WebGL 2 where there is none. A core of{ ' ' }
							{ kb( parts.core ) } KB, everything else a plugin. Choose how a slide turns
							into the next:
						</p>
						<div className="flex max-w-full flex-wrap items-center gap-2">
						<div
							ref={ pills }
							role="group"
							aria-labelledby="effect"
							className="sq-pill relative flex max-w-full min-w-0 gap-1 overflow-x-auto bg-black/30 p-1 ring-1 ring-white/12 backdrop-blur-xl [scrollbar-width:none]"
						>
							<span
								id="effect"
								className="flex shrink-0 cursor-default items-center gap-1.5 ps-3 pe-3 text-[0.8125rem] text-white/50 select-none"
							>
								Effect
							</span>
							<span aria-hidden className="my-2 mx-1 w-px shrink-0 bg-white/15" />
							{ mark && (
								<span
									aria-hidden
									className="sq-pill pointer-events-none absolute top-1 h-9 bg-white transition-[left,width] duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)] motion-reduce:transition-none"
									style={ { left: mark.left, width: mark.width } }
								/>
							) }
							{ ( Object.keys( TRANSITIONS ) as Name[] ).map( ( one ) => (
								<button
									key={ one }
									type="button"
									className={ `sq-pill relative h-9 shrink-0 cursor-pointer px-3.5 text-sm font-medium transition-colors duration-300 aria-[current]:text-black not-aria-[current]:text-white/70 not-aria-[current]:hover:text-white ${
										mark ? '' : 'aria-[current]:bg-white'
									}` }
									aria-current={ one === name ? 'true' : undefined }
									onClick={ () => setName( one ) }
								>
									{ one }
								</button>
							) ) }
							<span aria-hidden className="my-2 mx-1 w-px shrink-0 bg-white/15" />
							<a
								className="sq-pill inline-flex h-9 shrink-0 items-center px-3.5 text-sm text-white/50 transition hover:text-white"
								href="/playground/"
							>
								All { count( 'transition' ) }
							</a>
						</div>
						<label className="sq-pill flex h-11 shrink-0 items-center gap-3 bg-black/30 ps-4 pe-5 text-[0.8125rem] text-white/50 ring-1 ring-white/12 backdrop-blur-xl">
							Speed
							<input
								type="range"
								className="speed w-28"
								// Faster to the right: the time, the other way round.
								min={ FASTEST }
								max={ SLOWEST }
								step={ 100 }
								value={ FASTEST + SLOWEST - time }
								aria-valuetext={ `${ ( time / 1000 ).toFixed( 1 ) } seconds` }
								onChange={ ( event ) => {
									const to = FASTEST + SLOWEST - Number( event.target.value );
									setTime( to );
									slider.current?.set( { duration: to } );
								} }
							/>
						</label>
						</div>
					</div>
				}
			>
				<Slide image={ 1 } alt="Warm colour field" className="full" sizes="100vw" first>
					<h2 className={ SAID }>Drag it slowly</h2>
					<p className={ SAYS }>
						The transition follows the pointer: stop half way, go back.
					</p>
				</Slide>
				<Slide video="a" alt="Moving colour field" className="full" sizes="100vw">
					<h2 className={ SAID }>Films too</h2>
					<p className={ SAYS }>A transition into a film that plays.</p>
				</Slide>
				<Slide image={ 2 } alt="Blue colour field" className="full" sizes="100vw">
					<h2 className={ SAID }>The text is HTML</h2>
					<p className={ SAYS }>
						It can be read, found and chosen, on top of the canvas.
					</p>
				</Slide>
				<Slide image={ 4 } alt="Pink colour field" className="full" sizes="100vw">
					<h2 className={ SAID }>Without the canvas</h2>
					<p className={ SAYS }>
						A crossfade, drawn by the page, and all else the same.
					</p>
				</Slide>
			</GpuSlider>
		</div>
	);
}

/**
 * The first page: what the library is, what it weighs and how fast it
 * is, and where to go from here.
 */
export default function Home() {
	const gl = chromium.moving( 'gl', 20 );
	const gpu = chromium.moving( 'gpu', 20 );
	const scores = lighthouse( '/' );
	return (
		<>
			<Nav at="home" />
			{ /* The stage has the heading of the page: it is in the main part. */ }
			<main>
			<Stage />
			<div className="mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-36 px-5 pt-28 pb-40 md:gap-48 md:px-8 md:pt-36">
				<Section
					center
					id="several"
					title="Several at a time"
					note="Drag it, swipe it, or turn the wheel. The faster it goes, the more the pictures give way, and their colours come apart. A click lets one grow to the screen."
				>
					<GpuSlider
						id="row"
						label="Several at a time"
						options={ { loop: true } }
						className="cards whole bleed inset"
						made=""
						measured=""
						plugins={ () => [
							controls(),
							keyboard(),
							wheel(),
							canvas( {
								effects: [ stretch( { amount: 2 } ), split( { amount: 2.5 } ) ],
								layer: layer(),
							} ),
							lightbox(),
						] }
					>
						{ [ 8, 6, 5, 7, 4, 3, 2, 1 ].map( ( n ) => (
							<Slide
								key={ n }
								image={ n }
								alt={ `Colour field ${ n }` }
								className="card"
								// A card is higher than wide and most pictures are
								// wider than high: covering it takes about twice
								// the width of the card.
								sizes="(max-width: 640px) 160vw, 60vw"
							/>
						) ) }
					</GpuSlider>
				</Section>

				<div className="field">
					<Field />
				<Section
					center
					id="features"
					title="What it does"
					note="Every one of these is a page of the docs."
				>
					<ul
						data-testid="features"
						className="grid w-[min(1360px,calc(100vw-2.5rem))] gap-4 justify-self-center sm:grid-cols-2 xl:grid-cols-4"
					>
						{ FEATURES.map( ( { title, text, to, more, icon: Icon }, i ) => (
							<li
								key={ title }
								className="frost sq-tile relative grid content-start gap-3 p-7"
								style={ { '--tint': TINTS[ i % TINTS.length ] } as CSSProperties }
							>
								<span className="tint sq-knob mb-3 grid size-12 place-items-center">
									<Icon size={ 26 } weight="duotone" aria-hidden />
								</span>
								<h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
									{ title }
								</h3>
								<p className="text-muted-foreground">{ text }</p>
								<a
									// The whole card leads there.
									className="mt-1 text-sm font-medium text-foreground/80 after:absolute after:inset-0 after:rounded-[inherit] hover:text-foreground focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
									href={ to }
									aria-label={ `${ more }: ${ title }` }
								>
									{ more }
								</a>
							</li>
						) ) }
					</ul>
				</Section>

				<Section
					center
					id="effects"
					title="Effects"
					note="They go together: here a dome, parallax, and squares in the wake of the pointer that show their part closer, with colours that come apart. Every slide as wide as its picture, and a click lets one grow to the screen."
				>
					<GpuSlider
						id="auto"
						label="Widths from the images"
						options={ { loop: true, perView: 'auto', align: 'center' } }
						className="strip bleed"
						style={ { '--gs-gap': '16px' } as CSSProperties }
						made=""
						measured=""
						plugins={ () => [
							controls(),
							keyboard(),
							wheel(),
							canvas( {
								// As strong as 1.4 of the playground.
								effects: [
									cells( { zoom: 1.4, reach: 0.35 } ),
									parallax( { amount: 0.28 } ),
									dome( { amount: 1.12 } ),
									shift( { amount: 1.4 } ),
								],
								layer: layer(),
							} ),
							lightbox(),
						] }
					>
						{ [ 3, 1, 5, 8, 7, 2 ].map( ( n ) => (
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
					center
					id="numbers"
					title="In numbers"
					note="Measured, not guessed: the sizes by the build, the times by the benchmark of the repo. Below is what they were measured with."
				>
					<ul
						data-testid="numbers"
						className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3"
					>
						<Figure value={ kb( parts.core ) } unit="KB">
							The core, gzipped
						</Figure>
						<Figure value={ 0 }>Dependencies</Figure>
						<Figure value={ Math.round( chromium.until( 'gpu' ).second ) } unit="ms">
							Until a second slider is drawn by WebGPU. By WebGL:{ ' ' }
							{ ms( chromium.until( 'gl' ).second ) }
						</Figure>
						<Figure value={ `${ gpu.canvases } of ${ gpu.sliders }` }>
							Sliders of one page on the canvas of WebGPU. WebGL:{ ' ' }
							{ gl.canvases }
						</Figure>
						<Figure value={ 0 }>Frames drawn while nothing moves</Figure>
						<Figure value={ count( 'effect' ) + count( 'transition' ) }>
							Effects and transitions
						</Figure>
					</ul>
				</Section>

				{ scores && (
					<Section
						center
						id="score"
						title="Its score"
						note={ `What Lighthouse says of this page, with its sliders, its films and its canvas, as it is built. Asked on ${ asked }.` }
					>
						<Scores scores={ scores } />
					</Section>
				) }

				</div>

				<Section
					center
					id="use"
					title="In a page"
					note={ `From the least to load to the least to write. The library is not on npm yet.` }
				>
					<Ways />
					<div>
						<a className={ SECOND } href="/docs/">
							Get started
						</a>
					</div>
				</Section>

				<Section
					center
					id="size"
					title="What it weighs"
					note="A page has in its bundle what it names, and no more: every entry has named exports only and no side effects."
				>
					<Sizes />
				</Section>

				<Section
					center
					id="measured"
					title="WebGPU and WebGL, measured"
					note="The same sliders, made with each layer, in the same browser with the same GPU. In every cell: Chromium, and under it WebKit."
				>
					<Measured />
				</Section>

				<Section
					center
					id="examples"
					title="Made of it"
					note="Pages that are made of the library, and of little else."
				>
					<Shots />
					<div>
						<a className={ SECOND } href="/examples/">
							The examples
						</a>
					</div>
				</Section>
			</div>
			</main>
			<Footer />
		</>
	);
}
