import { lazy, Suspense, type ComponentType } from 'react';
import '@/index.css';
import 'gpuslider/style.css';
import '@/site.css';
import '@/text.css';
import './docs.css';
import { pages } from 'virtual:docs';
import { Footer, Nav, WIDTH } from '@/components/Frame';

/*
 * What a page of the docs shows of what it says. A page loads its own,
 * and the text does not wait for it.
 */
const DEMOS: Record< string, ComponentType > = {
	'': lazy( () => import( './demos/Start' ) ),
	html: lazy( () => import( './demos/Html' ) ),
	layout: lazy( () => import( './demos/Layout' ) ),
	options: lazy( () => import( './demos/Events' ) ),
	plugins: lazy( () => import( './demos/Plugins' ) ),
	canvas: lazy( () => import( './demos/Canvas' ) ),
	effects: lazy( () => import( './demos/Effects' ) ),
	lightbox: lazy( () => import( './demos/Lightbox' ) ),
	loading: lazy( () => import( './demos/Loading' ) ),
};

/**
 * A page of the docs. What it says is the README of the library, made
 * into HTML by the build: see `docs.ts`.
 */
export default function Docs( { slug, html }: { slug: string; html: string } ) {
	const at = pages.findIndex( ( page ) => page.slug === slug );
	const page = pages[ at ];
	const Demo = DEMOS[ slug ];
	return (
		<>
			<Nav at="docs" />
			<div
				className={ `${ WIDTH } grid grid-cols-[minmax(0,1fr)] gap-x-12 pb-32 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_13rem]` }
			>
				<nav aria-label="Pages of the docs" className="pages">
					<ul>
						{ pages.map( ( { slug: to, address, title } ) => (
							<li key={ to }>
								<a
									href={ address }
									aria-current={ to === slug ? 'page' : undefined }
								>
									{ title }
								</a>
							</li>
						) ) }
					</ul>
				</nav>

				<main className="min-w-0 pt-10 lg:pt-14">
					<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
						{ page.title }
					</h1>
					<p className="mt-4 max-w-2xl text-lg text-muted-foreground">
						{ page.lead }
					</p>

					{ Demo && (
						<div className="demo" data-testid="demo">
							<Suspense>
								<Demo />
							</Suspense>
						</div>
					) }

					<div
						className="prose"
						data-testid="text"
						dangerouslySetInnerHTML={ { __html: html } }
					/>

					<nav
						aria-label="The page before, and the next"
						className="mt-16 flex flex-wrap justify-between gap-4 border-t pt-6 text-sm"
					>
						{ at > 0 ? (
							<a rel="prev" href={ pages[ at - 1 ].address }>
								<span className="block text-muted-foreground">Before</span>
								<span className="font-medium">{ pages[ at - 1 ].title }</span>
							</a>
						) : (
							<span />
						) }
						{ pages[ at + 1 ] && (
							<a rel="next" href={ pages[ at + 1 ].address } className="text-end">
								<span className="block text-muted-foreground">Next</span>
								<span className="font-medium">{ pages[ at + 1 ].title }</span>
							</a>
						) }
					</nav>
				</main>

				{ page.headings.length > 1 && (
					<nav aria-label="On this page" className="here">
						<p>On this page</p>
						<ul>
							{ page.headings.map( ( { id, text } ) => (
								<li key={ id }>
									<a
										href={ `#${ id }` }
										dangerouslySetInnerHTML={ { __html: text } }
									/>
								</li>
							) ) }
						</ul>
					</nav>
				) }
			</div>
			<Footer />
		</>
	);
}
