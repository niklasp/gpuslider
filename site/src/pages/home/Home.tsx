import { useState, type CSSProperties, type ReactNode } from 'react';
import '@/index.css';
import 'gpuslider/style.css';
import '@/site.css';
import '@/text.css';
import './home.css';
import { code } from 'virtual:docs';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import {
	BUTTON,
	Code,
	FIRST,
	Footer,
	NAME,
	Nav,
	SECOND,
	Section,
	WIDTH,
} from '@/components/Frame';
import { Shots } from '@/components/Shots';
import {
	autoplay,
	controls,
	keyboard,
	marquee,
	stack,
	videos,
	wheel,
} from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import {
	burn,
	fold,
	glitch,
	liquid,
	mosaic,
	ripple,
	split,
	stretch,
	swirl,
	waves,
	wind,
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

/** How wide a slide that fills the page is. */
const WIDE = '(min-width: 1400px) 1400px, 100vw';

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
		<li className="grid content-start gap-1 rounded-xl border bg-muted/30 p-5">
			<span className="text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">
				{ value }
				{ unit && (
					<span className="ml-1 text-base font-medium text-muted-foreground">
						{ unit }
					</span>
				) }
			</span>
			<span className="text-sm text-muted-foreground">{ children }</span>
		</li>
	);
}

const FEATURES: { title: string; text: string; to: string; more: string }[] = [
	{
		title: 'Its own motion',
		text: 'A spring, solved exactly on every frame. Drag, swipe, the wheel, the keys. It snaps, loops, rests anywhere, goes sideways or downwards.',
		to: '/docs/options/',
		more: 'Options, API and events',
	},
	{
		title: 'WebGPU first',
		text: 'The canvas asks the browser and loads one layer: WebGPU where it is, WebGL 2 where not. Both draw the same picture, and the tests hold them against each other, effect by effect.',
		to: '/docs/canvas/',
		more: 'The canvas',
	},
	{
		title: `${ count( 'effect' ) } effects, written once`,
		text: 'Images that give way to the speed, colours that come apart, lenses and waves under the pointer, slides of jelly and of thick glass. An effect is a few lines of GLSL, and is translated for WebGPU when the shader is made.',
		to: '/docs/effects/',
		more: 'Effects',
	},
	{
		title: `${ count( 'transition' ) } transitions`,
		text: 'One slide turns into the next: liquid, burn, glitch, fold. They follow the pointer, so a slow drag stops half way. What is written for gl-transitions runs as it is.',
		to: '/docs/effects/',
		more: 'Transitions',
	},
	{
		title: 'Everything is a plugin',
		text: 'Arrows, dots, keys, autoplay, a ticker, thumbnails, videos that play in view. What is not imported is not in the bundle, and a plugin of your own is a function.',
		to: '/docs/plugins/',
		more: 'Plugins',
	},
	{
		title: 'Layout is CSS',
		text: 'Slides per view and the gap are custom properties, so what changes with the screen is a media query. Rows are a grid. The script measures what the page lays out.',
		to: '/docs/layout/',
		more: 'Layout',
	},
	{
		title: 'Three tiers',
		text: 'Without the script it is a native scroller with scroll-snap. Without the canvas the page draws the slides. With it the canvas draws the media, and the text stays HTML on top.',
		to: '/docs/#three-tiers',
		more: 'Get started',
	},
	{
		title: 'Idle is free',
		text: 'The canvas is made at the first sign of use: until then the page has no context and no shader. Shaders compile on another thread, and no frame is drawn while nothing moves.',
		to: '/docs/canvas/',
		more: 'The canvas',
	},
	{
		title: 'A lightbox',
		text: 'A click lets the image grow out of its slide to the screen, with the effects of the slider. Escape lets it go back into it.',
		to: '/docs/lightbox/',
		more: 'Lightbox',
	},
	{
		title: 'A loading screen',
		text: 'A screen while the media load: the one that comes with it, or any element of yours. And events that say how far it is, for a screen that is all your own.',
		to: '/docs/loading/',
		more: 'Loading',
	},
	{
		title: 'React',
		text: `A hook of ${ parts[ 'react: what useSlider adds' ] } bytes. React renders the slides, the library moves them, and slides that come and go are seen.`,
		to: '/docs/react/',
		more: 'React',
	},
	{
		title: 'No script of your own',
		text: `One file of ${ kb( files[ 'auto.js' ] ) } KB and attributes in the HTML. The canvas and the lightbox are loaded when a slider asks for them and the page has time.`,
		to: '/docs/html/',
		more: 'Without a script',
	},
];

/** The transitions that can be chosen here. The docs have all of them. */
const TRANSITIONS = { liquid, burn, glitch, ripple, swirl, fold, mosaic, wind };

type Name = keyof typeof TRANSITIONS;

/**
 * A stack that goes on by itself, and the transitions it can take. It
 * keeps what is chosen to itself: the page around it is not rendered
 * again.
 */
function Transitions() {
	const [ name, setName ] = useState< Name >( 'liquid' );
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-3">
			<div
				role="group"
				aria-label="Transition"
				className="flex flex-wrap gap-2"
			>
				{ ( Object.keys( TRANSITIONS ) as Name[] ).map( ( one ) => (
					<button
						key={ one }
						type="button"
						className={ BUTTON }
						aria-current={ one === name ? 'true' : undefined }
						onClick={ () => setName( one ) }
					>
						{ one }
					</button>
				) ) }
				<a className={ `${ BUTTON } text-muted-foreground` } href="/playground/">
					All { count( 'transition' ) }
				</a>
			</div>
			<GpuSlider
				id="turns"
				label="Slides that turn into each other"
				// Said in the HTML: a stack before the script is there.
				className="gs-stack"
				options={ { loop: true, duration: 1100 } }
				made={ name }
				measured=""
				pause
				plugins={ () => [
					controls(),
					keyboard(),
					videos(),
					stack(),
					autoplay( 3200 ),
					canvas( {
						effects: [ TRANSITIONS[ name ]() ],
						layer: layer(),
					} ),
				] }
			>
				<Slide image={ 6 } alt="Violet colour field" className="hero" sizes={ WIDE }>
					<h3 className="text-2xl font-semibold md:text-4xl">
						On top of each other
					</h3>
					<p className="text-white/80">
						The position runs through the transition.
					</p>
				</Slide>
				<Slide image={ 4 } alt="Pink colour field" className="hero" sizes={ WIDE }>
					<h3 className="text-2xl font-semibold md:text-4xl">
						Follows the pointer
					</h3>
					<p className="text-white/80">Drag slowly: stop half way, go back.</p>
				</Slide>
				<Slide video="b" alt="Moving colour field" className="hero" sizes={ WIDE }>
					<h3 className="text-2xl font-semibold md:text-4xl">Video too</h3>
					<p className="text-white/80">A transition into a film that plays.</p>
				</Slide>
				<Slide image={ 2 } alt="Blue colour field" className="hero" sizes={ WIDE }>
					<h3 className="text-2xl font-semibold md:text-4xl">
						A crossfade without the canvas
					</h3>
					<p className="text-white/80">The page draws, and all else is the same.</p>
				</Slide>
			</GpuSlider>
		</div>
	);
}

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
			<div role="tablist" aria-label="Ways to use it" className="flex flex-wrap gap-2">
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
					<a className="underline underline-offset-4" href="/docs/size/">
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
					className="underline underline-offset-4"
					href="/docs/canvas/#webgpu-and-webgl-measured"
				>
					What it says, and what it does not
				</a>
			</p>
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
			<main className={ `${ WIDTH } grid grid-cols-[minmax(0,1fr)] gap-20 pb-32` }>
				<div className="grid gap-8 pt-12 md:pt-20">
					<div>
						<p className="mb-4 font-mono text-xs tracking-wide text-muted-foreground uppercase">
							WebGPU where the browser has it · WebGL 2 where not
						</p>
						<h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-7xl">
							A slider drawn by shaders.
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted-foreground">
							It moves by its own spring, draws its pictures and films on a
							canvas, and leaves the text to the page. The core is{ ' ' }
							{ kb( parts.core ) } KB, everything else is a plugin, and it
							depends on nothing.
						</p>
						<nav
							aria-label="Where to go from here"
							className="mt-8 flex flex-wrap gap-3"
						>
							<a className={ FIRST } href="/docs/">
								Get started
							</a>
							<a className={ SECOND } href="/examples/">
								Examples
							</a>
							<a className={ SECOND } href="/playground/">
								Playground
							</a>
						</nav>
					</div>

					<GpuSlider
						id="first"
						label="What the slider is"
						options={ { loop: true } }
						made=""
						measured=""
						pause
						plugins={ () => [
							controls(),
							keyboard(),
							wheel(),
							videos(),
							autoplay( 5000 ),
							canvas( {
								effects: [ stretch(), split(), waves() ],
								layer: layer(),
							} ),
						] }
					>
						<Slide image={ 1 } alt="Warm colour field" className="hero" sizes={ WIDE } first>
							<h2 className="text-2xl font-semibold md:text-4xl">Drag it</h2>
							<p className="text-white/80">
								The picture gives way to the speed, and its colours come
								apart.
							</p>
						</Slide>
						<Slide video="a" alt="Someone walking into a tunnel of coloured lights" className="hero" sizes={ WIDE }>
							<h2 className="text-2xl font-semibold md:text-4xl">Films too</h2>
							<p className="text-white/80">
								They play while their slide is in view, with the same
								effects.
							</p>
						</Slide>
						<Slide image={ 2 } alt="Blue colour field" className="hero" sizes={ WIDE }>
							<h2 className="text-2xl font-semibold md:text-4xl">
								Move the pointer over it
							</h2>
							<p className="text-white/80">Rings run away from it.</p>
						</Slide>
						<Slide image={ 4 } alt="Pink colour field" className="hero" sizes={ WIDE }>
							<h2 className="text-2xl font-semibold md:text-4xl">
								The text is HTML
							</h2>
							<p className="text-white/80">
								It can be read, found and chosen, on top of the canvas.
							</p>
						</Slide>
					</GpuSlider>
				</div>

				<Section
					id="numbers"
					title="In numbers"
					note="Measured, not guessed: the sizes by the build, the times by the benchmark of the repo. Below is what they were measured with."
				>
					<ul
						data-testid="numbers"
						className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
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
						{ scores ? (
							<Figure value={ scores.desktop.performance }>
								Lighthouse performance of this page; { scores.mobile.performance }{ ' ' }
								on a phone. { asked }
							</Figure>
						) : (
							<Figure value={ count( 'effect' ) + count( 'transition' ) }>
								Effects and transitions
							</Figure>
						) }
					</ul>
				</Section>

				<Section
					id="features"
					title="What it does"
					note="Every one of these is a page of the docs."
				>
					<ul
						data-testid="features"
						className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
					>
						{ FEATURES.map( ( { title, text, to, more } ) => (
							<li
								key={ title }
								className="grid content-start gap-2 rounded-xl border p-5"
							>
								<h3 className="font-medium">{ title }</h3>
								<p className="text-sm text-muted-foreground">{ text }</p>
								<a
									className="mt-1 text-sm underline underline-offset-4"
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
					id="transitions"
					title="Transitions"
					note="Choose one. The slider goes on by itself, and waits while the pointer is over it: drag slowly to stop half way."
				>
					<Transitions />
				</Section>

				<Section
					id="ticker"
					title="A ticker"
					note="Runs by itself and without an end, slower under the pointer. Scroll the page: it runs faster, and the pictures give way to the speed."
				>
					<GpuSlider
						id="ticker"
						label="Ticker"
						options={ { loop: true, free: true } }
						className="cards"
						style={ { '--gs-per-view': 4.5, '--gs-gap': '16px' } as CSSProperties }
						made=""
						measured=""
						plugins={ () => [
							marquee( { speed: 50, hover: 0.2, scroll: 0.4 } ),
							canvas( { effects: [ stretch(), split() ], layer: layer() } ),
						] }
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
					id="use"
					title="In a page"
					note={ `From the least to load to the least to write. ${ NAME } is a working name, and the library is not on npm yet.` }
				>
					<Ways />
					<div>
						<a className={ SECOND } href="/docs/">
							Get started
						</a>
					</div>
				</Section>

				<Section
					id="size"
					title="What it weighs"
					note="A page has in its bundle what it names, and no more: every entry has named exports only and no side effects."
				>
					<Sizes />
				</Section>

				<Section
					id="measured"
					title="WebGPU and WebGL, measured"
					note="The same sliders, made with each layer, in the same browser with the same GPU. In every cell: Chromium, and under it WebKit."
				>
					<Measured />
				</Section>

				<Section
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
			</main>
			<Footer />
		</>
	);
}
