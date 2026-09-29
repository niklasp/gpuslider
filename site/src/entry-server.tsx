/**
 * The pages as HTML, for the build: a visitor sees them before any script
 * has run, and the browser finds the first image in them.
 */
import { StrictMode } from 'react';
import { prerender } from 'react-dom/static';
import App from './App';
import Wall from './pages/wall/Wall';
import Reel from './pages/reel/Reel';
import Tape from './pages/tape/Tape';

/** The pages, by the file they are written into. */
export const pages = {
	'index.html': App,
	'wall/index.html': Wall,
	'reel/index.html': Reel,
	'tape/index.html': Tape,
};

export async function render( file: keyof typeof pages ) {
	const Page = pages[ file ];
	const { prelude } = await prerender(
		<StrictMode>
			<Page />
		</StrictMode>
	);
	return new Response( prelude ).text();
}
