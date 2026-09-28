import {
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
} from 'react';
import { Button } from '@/components/ui/button';
import 'shaderslide/style.css';
import './site.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Controls } from '@/components/Controls';
import { ShaderSlider, Slide } from '@/components/ShaderSlider';
import { DEFAULTS, keyOf, pluginsOf, type Config } from '@/lib/config';

const media = ( name: string ) => `/media/${ name }`;

function Section( {
	title,
	note,
	children,
}: {
	title: string;
	note: string;
	children: React.ReactNode;
} ) {
	return (
		<section className="grid grid-cols-[minmax(0,1fr)] gap-4">
			<div>
				<h2 className="text-sm font-semibold tracking-wide uppercase">
					{ title }
				</h2>
				<p className="text-sm text-muted-foreground">{ note }</p>
			</div>
			{ children }
		</section>
	);
}

export default function App() {
	const [ config, setConfig ] = useState< Config >( DEFAULTS );
	const change = ( part: Partial< Config > ) =>
		setConfig( ( now ) => ( { ...now, ...part } ) );

	// The page begins below the controls, however many rows they take.
	const page = useRef< HTMLElement >( null );
	useLayoutEffect( () => {
		const bar = document.querySelector< HTMLElement >(
			'[data-testid="controls"]'
		)!;
		const fit = () => {
			page.current!.style.paddingTop = `${ bar.offsetHeight }px`;
			document.documentElement.style.scrollPaddingTop = `${ bar.offsetHeight }px`;
		};
		const observer = new ResizeObserver( fit );
		observer.observe( bar );
		fit();
		return () => observer.disconnect();
	}, [] );

	const made = keyOf( config );
	const focus = `${ config.focus.x }% ${ config.focus.y }%`;
	const measured = `${ config.perView } ${ config.gap } ${ focus }`;
	const look = { '--ss-focus': focus } as CSSProperties;
	const options = {
		loop: config.loop,
		free: config.free,
		duration: config.duration,
	};
	const shared = { made, measured, plugins: () => pluginsOf( config ) };

	// What the slider with the buttons outside of it said last.
	const [ log, setLog ] = useState< string[] >( [] );
	const heard = useCallback( ( name: string, detail: unknown ) => {
		const said =
			typeof detail === 'number' || typeof detail === 'boolean'
				? ` ${ detail }`
				: Array.isArray( detail ) && typeof detail[ 0 ] === 'number'
				? ` ${ detail.join( ', ' ) }`
				: '';
		setLog( ( now ) => [ `${ name }${ said }`, ...now ].slice( 0, 8 ) );
	}, [] );

	return (
		<TooltipProvider>
			<Controls config={ config } onChange={ change } />
			<main
				ref={ page }
				id="top"
				className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-16 px-4 pb-32 md:px-8"
			>
				<div className="pt-12">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
						A slider drawn by shaders.
					</h1>
					<p className="mt-3 max-w-2xl text-lg text-muted-foreground">
						Its own motion, no dependency, a few kilobytes. Drag, swipe,
						scroll sideways, use the arrow keys. Click a slide for the
						lightbox.
					</p>
				</div>

				<Section
					title="One per view"
					note="Images and a video. The text is HTML on top of the canvas."
				>
					<ShaderSlider
						id="one"
						label="One per view"
						options={ options }
						style={ look }
						pause={ config.autoplay }
						{ ...shared }
					>
						<Slide src={ media( '1.jpg' ) } alt="Warm colour field" className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">Own motion</h3>
							<p className="text-white/80">
								A spring, solved exactly on every frame.
							</p>
						</Slide>
						<Slide src={ media( 'a.mp4' ) } alt="Moving colour field" video className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">Video</h3>
							<p className="text-white/80">
								Plays while its slide is in view, with the same effects.
							</p>
						</Slide>
						<Slide src={ media( '2.jpg' ) } alt="Blue colour field" className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">
								No dependency
							</h3>
							<p className="text-white/80">The core is 6 KB.</p>
						</Slide>
						<Slide src={ media( '4.jpg' ) } alt="Pink colour field" className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">Idle is free</h3>
							<p className="text-white/80">
								No frame is drawn while nothing moves.
							</p>
						</Slide>
					</ShaderSlider>
				</Section>

				<Section
					title="Several per view"
					note="Slides per view and gap are CSS custom properties: set them under Slider."
				>
					<ShaderSlider
						id="several"
						label="Several per view"
						options={ options }
						className="cards"
						style={
							{
								...look,
								'--ss-per-view': config.perView,
								'--ss-gap': `${ config.gap }px`,
							} as CSSProperties
						}
						{ ...shared }
					>
						{ [ 1, 2, 3, 4, 5, 6, 7, 8 ].map( ( n ) => (
							<Slide
								key={ n }
								src={ media( `${ n }.jpg` ) }
								alt={ `Colour field ${ n }` }
								className="card"
							/>
						) ) }
					</ShaderSlider>
				</Section>

				<Section
					title="As wide as the image"
					note="Every slide takes the width of its image."
				>
					<ShaderSlider
						id="auto"
						label="Widths from the images"
						options={ { ...options, perView: 'auto', align: 'center' } }
						className="strip"
						style={ { ...look, '--ss-gap': `${ config.gap }px` } as CSSProperties }
						{ ...shared }
					>
						{ [
							[ 3, 1200, 1600 ],
							[ 1, 1600, 900 ],
							[ 5, 1400, 1400 ],
							[ 7, 1600, 700 ],
							[ 8, 1200, 1500 ],
							[ 2, 1600, 1200 ],
						].map( ( [ n, width, height ] ) => (
							<Slide
								key={ n }
								src={ media( `${ n }.jpg` ) }
								alt={ `Colour field ${ n }` }
								width={ width }
								height={ height }
							/>
						) ) }
					</ShaderSlider>
				</Section>

				<Section
					title="As high as the slide"
					note="The height follows the move, and the page below follows the height."
				>
					<div className="max-w-2xl">
						<ShaderSlider
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
							].map( ( [ n, width, height ] ) => (
								<Slide
									key={ n }
									src={ media( `${ n }.jpg` ) }
									alt={ `Colour field ${ n }` }
									width={ width }
									height={ height }
								/>
							) ) }
						</ShaderSlider>
					</div>
				</Section>

				<Section
					title="Stack"
					note="Slides on top of each other. The position runs through a transition: drag slowly to stop half way."
				>
					<ShaderSlider
						id="stack"
						label="Stack"
						options={ {
							...options,
							mode: 'stack',
							duration: Math.max( 900, config.duration * 1.8 ),
						} }
						style={ look }
						pause={ config.autoplay }
						made={ made }
						measured={ measured }
						plugins={ () => pluginsOf( config, 'stack' ) }
					>
						<Slide src={ media( '6.jpg' ) } alt="Violet colour field" className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">
								On top of each other
							</h3>
							<p className="text-white/80">Twenty transitions to choose from.</p>
						</Slide>
						<Slide src={ media( '4.jpg' ) } alt="Pink colour field" className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">
								Follows the pointer
							</h3>
							<p className="text-white/80">Stop half way, go back.</p>
						</Slide>
						<Slide src={ media( 'b.mp4' ) } alt="Moving colour field" video className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">Video too</h3>
							<p className="text-white/80">A transition into a playing video.</p>
						</Slide>
						<Slide src={ media( '2.jpg' ) } alt="Blue colour field" className="hero">
							<h3 className="text-2xl font-semibold md:text-4xl">
								A crossfade without WebGL
							</h3>
							<p className="text-white/80">Switch the canvas off to see it.</p>
						</Slide>
					</ShaderSlider>
				</Section>

				<Section
					title="Covers"
					note="An animation as a plugin. On the canvas it is an effect that turns the mesh; with the canvas off, the progress plugin tells the slides where they are and CSS turns them."
				>
					<ShaderSlider
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
								src={ media( `${ n }.jpg` ) }
								alt={ `Colour field ${ n }` }
								className="cover"
							/>
						) ) }
					</ShaderSlider>
				</Section>

				<Section
					title="Buttons anywhere, and events"
					note="The buttons are not in the slider: they name it with data-ss-for. The list is what the slider says while it is used."
				>
					<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
						<ShaderSlider
							id="remote"
							label="Driven from outside"
							options={ options }
							className="cards"
							style={
								{
									...look,
									'--ss-per-view': 2,
									'--ss-gap': `${ config.gap }px`,
								} as CSSProperties
							}
							heard={ heard }
							bare
							{ ...shared }
						>
							{ [ 2, 4, 6, 8, 1, 3 ].map( ( n ) => (
								<Slide
									key={ n }
									src={ media( `${ n }.jpg` ) }
									alt={ `Colour field ${ n }` }
									className="card wide"
								/>
							) ) }
						</ShaderSlider>
						<div className="grid content-start gap-4">
							<nav
								data-ss-for="remote"
								data-testid="remote-buttons"
								aria-label="Driven from outside"
								className="flex flex-wrap gap-2"
							>
								<Button variant="outline" size="sm" data-ss-prev>
									Back
								</Button>
								<Button variant="outline" size="sm" data-ss-next>
									On
								</Button>
								{ [ 0, 2, 4 ].map( ( n ) => (
									<Button
										key={ n }
										variant="outline"
										size="sm"
										data-ss-to={ n }
										className="aria-[current]:bg-foreground aria-[current]:text-background"
									>
										{ n + 1 }
									</Button>
								) ) }
							</nav>
							<ol
								data-testid="events"
								aria-label="Events"
								className="min-h-44 rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5 text-muted-foreground"
							>
								{ log.map( ( line, i ) => (
									<li key={ log.length - i } className="first:text-foreground">
										{ line }
									</li>
								) ) }
							</ol>
						</div>
					</div>
				</Section>
			</main>
		</TooltipProvider>
	);
}
