/**
 * What the pages of the site have in common: the bar at the top, the
 * foot, and how a section and a button look.
 */
import type { ReactNode } from 'react';
import { GithubLogo, ImageSquare, Swatches } from './icons';
import { choose, useKind, type Kind } from '@/lib/media';

/** The name: it is said here, and nowhere else on the site. */
export const NAME = 'gpu slider';

/** Where the code is. */
export const REPO = 'https://github.com/niklasp/gpuslider';

/** A button of the site, as the controls have them. */
export const BUTTON =
	'sq-knob inline-flex h-9 cursor-pointer items-center bg-secondary px-3.5 text-sm font-medium transition hover:bg-accent disabled:cursor-default disabled:opacity-40 aria-[current]:bg-foreground aria-[current]:text-background';

/** The button of a page that is the one to press. */
export const FIRST =
	'sq-knob inline-flex h-12 items-center bg-primary px-6 font-medium text-primary-foreground transition hover:bg-primary/85';

/** The same for what may be pressed as well. */
export const SECOND =
	'sq-knob inline-flex h-12 items-center bg-secondary px-6 font-medium transition hover:bg-accent';

/** As wide as the pages are. */
export const WIDTH = 'mx-auto max-w-[1400px] px-4 md:px-8';

const PAGES = {
	docs: [ '/docs/', 'Docs' ],
	examples: [ '/examples/', 'Examples' ],
	playground: [ '/playground/', 'Playground' ],
} as const;

export type At = keyof typeof PAGES | 'home';

const KINDS: [ Kind, string, typeof Swatches ][] = [
	[ 'fields', 'Colour fields', Swatches ],
	[ 'photos', 'Photos', ImageSquare ],
];

/**
 * Which pictures the sliders of the site show: two buttons of glass, top
 * right. On a phone there is no room beside the bar: there it is one
 * button in it, that says whether the photos are shown.
 */
function Pictures() {
	const kind = useKind();
	return (
		<div
			role="group"
			aria-label="Pictures"
			className="hidden items-center gap-1 sm:flex"
		>
			{ KINDS.map( ( [ one, label, Icon ] ) => (
				<button
					key={ one }
					type="button"
					aria-label={ label }
					title={ label }
					aria-pressed={ one === kind }
					onClick={ () => choose( one ) }
					className="sq-pill grid size-9 cursor-pointer place-items-center text-white/55 transition hover:text-white aria-pressed:bg-white/12 aria-pressed:text-white"
				>
					<Icon size={ 18 } weight={ one === kind ? 'fill' : 'regular' } />
				</button>
			) ) }
		</div>
	);
}

/** The one button of the pictures, on a phone. */
function Photos() {
	const kind = useKind();
	return (
		<button
			type="button"
			aria-label="Photos"
			aria-pressed={ kind === 'photos' }
			onClick={ () => choose( kind === 'photos' ? 'fields' : 'photos' ) }
			className="sq-pill grid size-9 shrink-0 cursor-pointer place-items-center text-white/55 transition hover:text-white aria-pressed:bg-white/12 aria-pressed:text-white sm:hidden"
		>
			<ImageSquare size={ 18 } weight={ kind === 'photos' ? 'fill' : 'regular' } />
		</button>
	);
}

/**
 * A bar of glass that floats over the page. On the first page it floats
 * over the slider, and takes no room of its own.
 */
export function Nav( { at }: { at: At } ) {
	return (
		<header
			className={ `pointer-events-none inset-x-0 top-0 z-40 flex h-[4.5rem] items-center justify-center px-4 ${
				at === 'home' ? 'fixed' : 'sticky'
			}` }
		>
			<div className="sq-pill pointer-events-auto flex h-12 items-center gap-x-1 bg-black/45 ps-4 pe-1.5 sm:ps-5 ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150">
				<a
					href="/"
					aria-current={ at === 'home' ? 'page' : undefined }
					className="me-2 font-display text-[0.9375rem] font-semibold tracking-[-0.02em] sm:me-4"
				>
					{ NAME }
				</a>
				<nav aria-label="Pages" className="flex text-sm">
					{ ( Object.keys( PAGES ) as ( keyof typeof PAGES )[] ).map(
						( name ) => (
							<a
								key={ name }
								href={ PAGES[ name ][ 0 ] }
								aria-current={ at === name ? 'page' : undefined }
								className="sq-pill px-2 py-2 text-white/65 transition hover:text-white aria-[current]:bg-white/12 aria-[current]:text-white sm:px-3.5"
							>
								{ PAGES[ name ][ 1 ] }
							</a>
						)
					) }
				</nav>
				<span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-white/15" />
				<Pictures />
				<Photos />
			</div>
			<a
				href={ REPO }
				aria-label="The code on GitHub"
				title="The code on GitHub"
				className="sq-pill pointer-events-auto absolute end-4 top-3 hidden size-12 place-items-center bg-black/45 text-white/70 ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150 transition hover:text-white sm:grid md:end-5"
			>
				<GithubLogo size={ 20 } weight="fill" />
			</a>
		</header>
	);
}

export function Footer() {
	return (
		<footer className="border-t border-white/8">
			<div
				className={ `${ WIDTH } flex flex-wrap items-baseline gap-x-6 gap-y-2 py-8 text-sm text-muted-foreground` }
			>
				<span className="font-display font-medium text-foreground">{ NAME }</span>
				<span>Not on npm yet.</span>
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
					<a className="hover:text-foreground" href={ REPO }>
						GitHub
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
	center,
	children,
}: {
	id?: string;
	title: string;
	note: ReactNode;
	/** The heading in the middle, over what is below it. */
	center?: boolean;
	children: ReactNode;
} ) {
	return (
		<section
			id={ id }
			className={ `grid scroll-mt-24 grid-cols-[minmax(0,1fr)] ${
				center ? 'gap-12' : 'gap-6'
			}` }
		>
			<div className={ `grid gap-3 ${ center ? 'justify-items-center text-center' : '' }` }>
				<h2 className="font-display text-3xl font-semibold tracking-[-0.035em] text-balance md:text-5xl">
					{ title }
				</h2>
				<p className="max-w-2xl text-lg text-balance text-muted-foreground">{ note }</p>
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
