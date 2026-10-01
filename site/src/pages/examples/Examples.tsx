import '@/index.css';
import { Footer, Nav, SECOND, WIDTH } from '@/components/Frame';
import { Shots } from '@/components/Shots';

/**
 * The pages that are made of the library, and the way to them.
 */
export default function Examples() {
	return (
		<>
			<Nav at="examples" />
			<main className={ `${ WIDTH } grid grid-cols-[minmax(0,1fr)] gap-14 pb-32` }>
				<div className="pt-12 md:pt-20">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
						Examples
					</h1>
					<p className="mt-4 max-w-2xl text-lg text-muted-foreground">
						Pages that are made of the library, and of little else. Each
						can be drawn by either layer, and leads to its code; most wait
						for their pictures behind a screen of their own kind.
					</p>
				</div>
				<Shots all />
				<div className="sq-tile grid gap-3 bg-card p-6 md:p-8">
					<h2 className="text-2xl font-semibold">Everything, with controls</h2>
					<p className="max-w-2xl text-sm text-muted-foreground">
						The playground has every layout, every effect and every
						transition, the lightbox and the loading screen, and says under
						every slider who draws it and what a frame costs.
					</p>
					<div>
						<a className={ SECOND } href="/playground/">
							Playground
						</a>
					</div>
				</div>
			</main>
			<Footer />
		</>
	);
}
