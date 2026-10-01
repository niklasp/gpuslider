import { codeOf } from '@/pages/mount';

/**
 * The examples, as pictures of them that lead to them.
 */

export const EXAMPLES = [
	{
		name: 'resolve',
		title: 'Resolve',
		text: 'Rows of pictures that come out, part by part, as they come into view: in pixels, halftone dots, slices, shards, dither, scanlines, glyphs, threads or ink, as you choose. They break up again when the page is scrolled fast or a row is thrown. Click one to open it. After the scroll-revealed gallery of Chakib Mazouni.',
		made: [ 'loading()', 'lightbox()', 'an effect of its own' ],
	},
	{
		name: 'reveal',
		title: 'Reveal',
		text: 'An index of work: each picture opens out of the pointer and turns into the next as you move down the names, in eleven ways: burnt, out of smoke, as a drop, shattered, in blocks, through blinds, struck by lightning, out of frost, in dots, through a heat camera or a whirl. Click one to open it. After the shader reveal of Colin Demouge.',
		made: [ 'stack()', 'loading()', 'lightbox()', 'effects of its own' ],
	},
	{
		name: 'orbit',
		title: 'Orbit',
		text: 'One row of pictures rolled up into a cylinder that the page turns as it is scrolled, and a drag throws round. Scrolled on, it tips, takes you inside, and unrolls into the slider it always was. Below it, a second slider is its reflection. After the On-Scroll 3D Carousel of Manoela Ilic.',
		made: [ 'loading()', 'lightbox()', 'stretch', 'effects of its own' ],
	},
	{
		name: 'echo',
		title: 'Echo',
		text: 'A reel of photos that leave frames of themselves behind as they move, the farther apart the faster. Pick a photo below and it arrives as a stream of frames, all drawn by one pass of the canvas. After Animating in Frames by Manoela Ilic.',
		made: [ 'thumbs()', 'autoplay()', 'keyboard()', 'loading()', 'an effect of its own' ],
	},
	{
		name: 'fold',
		title: 'Fold',
		text: 'Walls of small pictures that fold into place one after another as the page is scrolled, each in its own order: column by column, along a diagonal, from the middle out, or like rain; flat in the middle of the screen. Every wall is one slider whose track is a grid, drawn by one canvas; drag it sideways, click a picture to open it. After the staggered 3D grid animations of Manoela Ilic.',
		made: [ 'lightbox()', 'loading()', 'effects of its own' ],
	},
	{
		name: 'reel',
		title: 'A reel',
		text: 'Pictures and films as large as the screen, that the page scrolls down through: each flows into the next as far as the page has gone, backwards when it goes back, and the page comes to rest on one. The screen before it is made of the events of loading(): a number that runs, a curtain that goes up.',
		made: [ 'useSlider()', 'stack()', 'videos()', 'loading()', 'liquid', 'split', 'waves' ],
	},
	{
		name: 'tape',
		title: 'Tape',
		text: 'Rows that run against each other on a page that scrolls. The scrolling pushes them, and what is pushed gives way. The loading screen is the one of the library.',
		made: [ 'marquee()', 'loading()', 'jelly', 'stretch', 'split' ],
	},
	{
		name: 'loom',
		title: 'Loom',
		text: 'Portraits that run by, and come apart into threads where they leave the screen and where they come in. After Unwoven by Clément Grellier.',
		made: [ 'marquee()', 'keyboard()', 'wheel()', 'loading()', 'unweave', 'stretch' ],
	},
	{
		name: 'wave',
		title: 'Wave',
		text: 'Bands of pictures that run against each other, on five pages, each wilder than the last: two bands, curves, a crossing, depth, and rings that turn. The canvas turns, bends and places the rows; a click opens the picture that is seen. The pictures are made by code.',
		made: [ 'marquee()', 'loading()', 'lightbox()', 'bend', 'jelly', 'stretch', 'split', 'effects of its own' ],
	},
	{
		name: 'depth',
		title: 'Depth',
		text: 'A gallery whose pictures move slower than their frames, and a panel that changes how much while it runs: the effects read their numbers on every frame.',
		made: [ 'controls()', 'keyboard()', 'wheel()', 'loading()', 'parallax', 'stretch' ],
	},
	{
		name: 'journal',
		title: 'Journal',
		text: 'Stories in a slider whose pictures the canvas draws. Open one, and its picture leaves the slider and becomes the top of the story, on another page: a view transition between documents, where the browser has them.',
		made: [ 'controls()', 'autoplay()', 'keyboard()', 'wheel()', 'stretch', '@view-transition' ],
	},
] as const;

export function Shots( { all }: { all?: boolean } ) {
	return (
		<ul
			data-testid="examples"
			className={
				all
					? 'grid gap-10'
					: 'grid gap-x-6 gap-y-10 md:grid-cols-3'
			}
		>
			{ /* Six on the first page: two rows of three. */ }
			{ EXAMPLES.slice( 0, all ? undefined : 6 ).map( ( { name, title, text, made } ) => (
				<li
					key={ name }
					className={
						all
							? 'grid items-start gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
							: 'grid content-start gap-4'
					}
				>
					<a
						href={ `/examples/${ name }/` }
						aria-label={ title }
						className="sq-tile block overflow-hidden bg-card outline-offset-4 transition hover:brightness-110"
					>
						<img
							className="block aspect-[16/10] h-auto w-full object-cover"
							src={ `/shots/${ name }.avif` }
							width="1280"
							height="800"
							alt={ `The page “${ title }”` }
							loading="lazy"
							decoding="async"
						/>
					</a>
					<div className={ `grid content-start gap-2 ${ all ? 'md:sticky md:top-28' : '' }` }>
						{ all ? (
							<h2 className="font-display text-3xl font-light tracking-[-0.035em]">
								<a href={ `/examples/${ name }/` }>{ title }</a>
							</h2>
						) : (
							<h3 className="font-display text-xl tracking-[-0.015em]">
								<a href={ `/examples/${ name }/` }>{ title }</a>
							</h3>
						) }
						<p className="text-sm text-muted-foreground">{ text }</p>
						{ all && (
							<>
								<ul
									aria-label="Made of"
									className="flex flex-wrap gap-1.5 font-mono text-xs text-muted-foreground"
								>
									{ made.map( ( part ) => (
										<li key={ part } className="sq-knob bg-secondary px-2 py-1">
											{ part }
										</li>
									) ) }
								</ul>
								<p className="mt-2 flex flex-wrap gap-2">
									<a
										className="sq-knob inline-flex h-9 items-center bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85"
										href={ `/examples/${ name }/` }
									>
										Open it
									</a>
									<a
										className="sq-knob inline-flex h-9 items-center bg-secondary px-3.5 text-sm font-medium transition hover:bg-accent"
										href={ codeOf( name ) }
									>
										Code
									</a>
								</p>
							</>
						) }
					</div>
				</li>
			) ) }
		</ul>
	);
}
