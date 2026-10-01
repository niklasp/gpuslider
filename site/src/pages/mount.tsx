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

/** Where the code of an example is: its folder in the repository. */
export const codeOf = ( name: string ) =>
	`https://github.com/niklasp/gpuslider/tree/main/site/src/pages/${ name }`;

/**
 * What the bar at the top of an example says: the way back to the
 * examples at the left; at the right what the page is, what it is made
 * with, for those who come to it from elsewhere, and where its code is.
 */
export function Bar( { children, code }: { children: ReactNode; code?: string } ) {
	return (
		<>
			<a href="/examples/">← Examples</a>
			<span>
				{ children } · Made with <a href="/">gpu slider</a>
				{ code && (
					<>
						{ ' · ' }
						<a href={ codeOf( code ) }>Code</a>
					</>
				) }
			</span>
		</>
	);
}

/**
 * A choice of the page that a link can carry, as `?<name>=<value>`: read
 * once the page runs (the build renders the default), and written back
 * as it changes, so the address in the bar shows what is seen.
 */
export function shared< T extends string >( name: string, values: readonly T[] ): T | undefined {
	if ( typeof location === 'undefined' ) {
		return undefined;
	}
	const value = new URLSearchParams( location.search ).get( name )?.toLowerCase();
	return values.find( ( one ) => one.toLowerCase() === value );
}

/** Writes a choice into the address, without a new entry in the history. */
export function share( name: string, value: string | number | undefined ) {
	const url = new URL( location.href );
	if ( value === undefined || value === '' ) {
		url.searchParams.delete( name );
	} else {
		url.searchParams.set( name, String( value ).toLowerCase() );
	}
	history.replaceState( history.state, '', url );
}
