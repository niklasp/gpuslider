import { StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

/**
 * Puts a page of the site into the document. The build has rendered it
 * already (see `prerender.mjs`); the server of `npm run dev` has not.
 */
export function mount( page: ReactNode ) {
	const root = document.getElementById( 'root' )!;
	const app = <StrictMode>{ page }</StrictMode>;
	if ( root.firstElementChild ) {
		hydrateRoot( root, app );
	} else {
		createRoot( root ).render( app );
	}
}

/** `?layer=gl` and `?layer=gpu` say who draws. */
export function layer(): 'gl' | 'gpu' | undefined {
	// The build renders the pages too, and has no address.
	if ( typeof location === 'undefined' ) {
		return undefined;
	}
	const name = new URLSearchParams( location.search ).get( 'layer' );
	return name === 'gl' || name === 'gpu' ? name : undefined;
}

/** The name of a layer, as people say it. */
export const drawnBy = ( name: unknown ) =>
	name === 'gpu' ? 'WebGPU' : 'WebGL';

/**
 * What the bar at the top of an example says: the way back to the
 * examples at the left; at the right what the page is, and what it is
 * made with, for those who come to it from elsewhere.
 */
export function Bar( { children }: { children: ReactNode } ) {
	return (
		<>
			<a href="/examples/">← Examples</a>
			<span>
				{ children } · Made with <a href="/">gpu slider</a>
			</span>
		</>
	);
}
