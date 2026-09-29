/**
 * The examples, as pictures of them that lead to them.
 */

export const EXAMPLES = [
	{
		name: 'wall',
		title: 'A wall of glass',
		text: 'A wall of pictures behind thick glass, without an end in any direction. Every row is a slider, the rows are the slides of a slider that goes down, and the page takes the pointer and moves both. Drag it.',
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
] as const;

export function Shots( { all }: { all?: boolean } ) {
	return (
		<ul
			data-testid="examples"
			className={
				all
					? 'grid gap-10'
					: 'grid gap-4 md:grid-cols-3'
			}
		>
			{ EXAMPLES.map( ( { name, title, text, made } ) => (
				<li
					key={ name }
					className={
						all
							? 'grid items-center gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
							: 'grid content-start gap-3'
					}
				>
					<a
						href={ `/examples/${ name }/` }
						aria-label={ title }
						className="block overflow-hidden rounded-xl border transition hover:border-foreground/40"
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
							<h2 className="text-2xl font-semibold">
								<a href={ `/examples/${ name }/` }>{ title }</a>
							</h2>
						) : (
							<h3 className="font-medium">
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
										<li key={ part } className="rounded-md border px-2 py-1">
											{ part }
										</li>
									) ) }
								</ul>
								<p className="mt-2 flex flex-wrap gap-2">
									<a
										className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
										href={ `/examples/${ name }/` }
									>
										Open it
									</a>
									<a
										className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-accent dark:border-input dark:bg-input/30"
										href={ `/examples/${ name }/?layer=gpu` }
									>
										Drawn by WebGPU
									</a>
									<a
										className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-accent dark:border-input dark:bg-input/30"
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
