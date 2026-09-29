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
import Wall from './pages/wall/Wall';
import Reel from './pages/reel/Reel';
import Tape from './pages/tape/Tape';
import Phone from './pages/phone/Phone';
import Loom from './pages/loom/Loom';
import Wave from './pages/wave/Wave';
import Depth from './pages/depth/Depth';

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
	'examples/wall/index.html': { page: () => <Wall /> },
	'examples/reel/index.html': { page: () => <Reel /> },
	'examples/tape/index.html': { page: () => <Tape /> },
	'examples/loom/index.html': { page: () => <Loom /> },
	'examples/wave/index.html': { page: () => <Wave /> },
	'examples/depth/index.html': { page: () => <Depth /> },
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
