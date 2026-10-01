/**
 * The examples, as pictures of them that lead to them.
 */

export const EXAMPLES = [
	{
		name: 'wall',
		title: 'A wall of glass',
		text: 'A wall of pictures behind thick glass, without an end in any direction. Every row is a slider, the rows are the slides of a slider that goes down, and the page takes the pointer and moves both. Drag it. Glass after glass-effect-webgpu by jeantimex.',
		made: [ 'marquee()', 'loading()', 'dome', 'jelly', 'slab' ],
	},
	{
		name: 'reel',
		title: 'A reel',
		text: 'One picture or film at a time, as large as the screen, that turn into each other. The screen before it is made of the events of loading(): a number that runs, a curtain that goes up.',
		made: [ 'stack()', 'autoplay()', 'videos()', 'loading()', 'warp', 'split', 'waves' ],
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
		made: [ 'marquee()', 'loading()', 'unweave', 'stretch' ],
	},
	{
		name: 'wave',
		title: 'Wave',
		text: 'Bands of pictures that run against each other, on five pages, each wilder than the last: two bands, curves, a crossing, depth, and rings that turn. The canvas turns, bends and places the rows; a click opens the picture that is seen. The pictures are made by code.',
		made: [ 'marquee()', 'lightbox()', 'bend', 'jelly', 'stretch', 'split', 'effects of its own' ],
	},
	{
		name: 'depth',
		title: 'Depth',
		text: 'A gallery whose pictures move slower than their frames, and a panel that changes how much while it runs: the effects read their numbers on every frame.',
		made: [ 'controls()', 'loading()', 'parallax', 'stretch' ],
	},
	{
		name: 'journal',
		title: 'Journal',
		text: 'Stories in a slider whose pictures the canvas draws. Open one, and its picture leaves the slider and becomes the top of the story, on another page: a view transition between documents, where the browser has them.',
		made: [ 'controls()', 'parallax', 'stretch', '@view-transition' ],
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
							? 'grid items-center gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
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
					<div className="grid content-start gap-2">
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
										href={ `/examples/${ name }/?layer=gpu` }
									>
										Drawn by WebGPU
									</a>
									<a
										className="sq-knob inline-flex h-9 items-center bg-secondary px-3.5 text-sm font-medium transition hover:bg-accent"
										href={ `/examples/${ name }/?layer=gl` }
									>
										Drawn by WebGL
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
