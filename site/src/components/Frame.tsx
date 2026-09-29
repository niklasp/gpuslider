/**
 * What the pages of the site have in common: the bar at the top, the
 * foot, and how a section and a button look.
 */
import type { ReactNode } from 'react';

/** A working name: it is said here, and nowhere else on the site. */
export const NAME = 'shaderslide';

/** A button of the site, as the controls have them. */
export const BUTTON =
	'inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition hover:bg-accent disabled:cursor-default disabled:opacity-40 aria-[current]:bg-foreground aria-[current]:text-background dark:border-input dark:bg-input/30 dark:aria-[current]:bg-foreground';

/** The button of a page that is the one to press. */
export const FIRST =
	'inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/80';

/** The same for what may be pressed as well. */
export const SECOND =
	'inline-flex h-10 items-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs transition hover:bg-accent dark:border-input dark:bg-input/30';

/** As wide as the pages are. */
export const WIDTH = 'mx-auto max-w-[1400px] px-4 md:px-8';

const PAGES = {
	docs: [ '/docs/', 'Docs' ],
	examples: [ '/examples/', 'Examples' ],
	playground: [ '/playground/', 'Playground' ],
} as const;

export type At = keyof typeof PAGES | 'home';

export function Nav( { at }: { at: At } ) {
	return (
		<header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
			<div className={ `${ WIDTH } flex h-14 items-center gap-x-6` }>
				<a
					href="/"
					aria-current={ at === 'home' ? 'page' : undefined }
					className="text-base font-semibold tracking-tight"
				>
					{ NAME }
				</a>
				<nav aria-label="Pages" className="flex gap-x-1 text-sm">
					{ ( Object.keys( PAGES ) as ( keyof typeof PAGES )[] ).map(
						( name ) => (
							<a
								key={ name }
								href={ PAGES[ name ][ 0 ] }
								aria-current={ at === name ? 'page' : undefined }
								className="rounded-md px-2.5 py-1.5 text-muted-foreground transition hover:text-foreground aria-[current]:text-foreground"
							>
								{ PAGES[ name ][ 1 ] }
							</a>
						)
					) }
				</nav>
			</div>
		</header>
	);
}

export function Footer() {
	return (
		<footer className="border-t">
			<div
				className={ `${ WIDTH } flex flex-wrap items-baseline gap-x-6 gap-y-2 py-8 text-sm text-muted-foreground` }
			>
				<span className="font-semibold text-foreground">{ NAME }</span>
				<span>A working name. Not on npm yet.</span>
				<nav aria-label="Pages, again" className="flex flex-wrap gap-x-4 md:ml-auto">
					<a className="hover:text-foreground" href="/docs/">
						Docs
					</a>
					<a className="hover:text-foreground" href="/examples/">
						Examples
					</a>
					<a className="hover:text-foreground" href="/playground/">
						Playground
					</a>
					<a className="hover:text-foreground" href="/docs/size/">
						Sizes
					</a>
					<a className="hover:text-foreground" href="/llms.txt">
						llms.txt
					</a>
				</nav>
			</div>
		</footer>
	);
}

export function Section( {
	id,
	title,
	note,
	children,
}: {
	id?: string;
	title: string;
	note: ReactNode;
	children: ReactNode;
} ) {
	return (
		<section id={ id } className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-4">
			<div>
				<h2 className="text-sm font-semibold tracking-wide uppercase">
					{ title }
				</h2>
				<p className="max-w-3xl text-sm text-muted-foreground">{ note }</p>
			</div>
			{ children }
		</section>
	);
}

/** Code, with the colours the build gave it. */
export function Code( { html, label }: { html: string; label?: string } ) {
	return (
		<pre
			className="code"
			tabIndex={ 0 }
			aria-label={ label || 'Code' }
			dangerouslySetInnerHTML={ { __html: `<code>${ html }</code>` } }
		/>
	);
}
