import { StrictMode, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
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
		// At once: a page that waits to be shown waits for this.
		flushSync( () => createRoot( root ).render( app ) );
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
