/**
 * The pages as HTML, for the build: a visitor sees them before any script
 * has run, and the browser finds the first image in them.
 */
import { StrictMode, type ReactNode } from 'react';
import { prerender } from 'react-dom/static';
import { load, pages as docs } from 'virtual:docs';
import { NAME } from './components/Frame';
import Home from './pages/home/Home';
import Docs from './pages/docs/Docs';
import Examples from './pages/examples/Examples';
import Playground from './pages/playground/Playground';
import Reel from './pages/reel/Reel';
import Tape from './pages/tape/Tape';
import Phone from './pages/phone/Phone';
import Loom from './pages/loom/Loom';
import Wave, { WAVES } from './pages/wave/Wave';
import Depth from './pages/depth/Depth';
import { Journal, Story } from './pages/journal/Journal';
import { STORIES } from './pages/journal/stories';
import Orbit from './pages/orbit/Orbit';
import Fold from './pages/fold/Fold';
import Resolve from './pages/resolve/Resolve';
import Reveal from './pages/reveal/Reveal';
import Echo from './pages/echo/Echo';

type Page = {
	/** The file of the build the page is made of, where it is another. */
	from?: string;
	/** For pages that are made of the file of another. */
	title?: string;
	description?: string;
	page: () => ReactNode | Promise< ReactNode >;
};

/** The pages, by the file they are written into. */
export const pages: Record< string, Page > = {
	'index.html': { page: () => <Home /> },
	'examples/index.html': { page: () => <Examples /> },
	'examples/reel/index.html': { page: () => <Reel /> },
	'examples/tape/index.html': { page: () => <Tape /> },
	'examples/loom/index.html': { page: () => <Loom /> },
	'examples/wave/index.html': { page: () => <Wave /> },
	...Object.fromEntries(
		WAVES.slice( 1 ).map( ( { id, title } ) => [
			`examples/wave/${ id }/index.html`,
			{
				from: 'examples/wave/index.html',
				title: `${ title } · Wave · ${ NAME }`,
				description: `Bands of pictures that run against each other: ${ title.toLowerCase() }.`,
				page: () => <Wave stage={ id } />,
			},
		] )
	),
	'examples/depth/index.html': { page: () => <Depth /> },
	'examples/journal/index.html': { page: () => <Journal /> },
	'examples/orbit/index.html': { page: () => <Orbit /> },
	'examples/fold/index.html': { page: () => <Fold /> },
	'examples/resolve/index.html': { page: () => <Resolve /> },
	'examples/reveal/index.html': { page: () => <Reveal /> },
	'examples/echo/index.html': { page: () => <Echo /> },
	...Object.fromEntries(
		STORIES.map( ( { slug, title, about } ) => [
			`examples/journal/${ slug }/index.html`,
			{
				from: 'examples/journal/index.html',
				title: `${ title } · Afterlight · ${ NAME }`,
				description: about,
				page: () => <Story slug={ slug } />,
			},
		] )
	),
	'playground/index.html': { page: () => <Playground /> },
	'phone/index.html': { page: () => <Phone /> },
	...Object.fromEntries(
		docs.map( ( { slug, address, title, lead } ) => [
			`${ address.slice( 1 ) }index.html`,
			{
				from: 'docs/index.html',
				title: `${ title } · Docs · ${ NAME }`,
				description: lead,
				page: async () => (
					<Docs slug={ slug } html={ ( await load[ slug ]() ).default } />
				),
			},
		] )
	),
};

export async function render( file: string ) {
	const { prelude } = await prerender(
		<StrictMode>{ await pages[ file ].page() }</StrictMode>
	);
	return new Response( prelude ).text();
}
