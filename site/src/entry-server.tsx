/**
 * The page as HTML, for the build: a visitor sees it before any script has
 * run, and the browser finds the first image in it.
 */
import { StrictMode } from 'react';
import { prerender } from 'react-dom/static';
import App from './App';

export async function render() {
	const { prelude } = await prerender(
		<StrictMode>
			<App />
		</StrictMode>
	);
	return new Response( prelude ).text();
}
