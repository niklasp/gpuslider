/**
 * `<Slider>` rendered on a server and hydrated in the browser, as Next.js
 * does it: React finds the markup it would have made, and nothing of the
 * page moves when the script comes, nor when the canvas takes over.
 */
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { App } from './ssr-app.js';

const require = createRequire( import.meta.url );

let html;
let react;

test.beforeAll( async () => {
	html = renderToString( createElement( App ) );
	// React for the browser as one module: `react` and `react-dom/client`
	// by an import map, as a bundler would give them.
	const names = Object.keys( require( 'react' ) ).filter( ( name ) =>
		/^[A-Za-z_]\w*$/.test( name )
	);
	const made = await build( {
		stdin: {
			contents: `import * as React from 'react';
export const { ${ names.join( ', ' ) } } = React;
export default React;
export { hydrateRoot } from 'react-dom/client';`,
			resolveDir: process.cwd(),
		},
		bundle: true,
		format: 'esm',
		write: false,
		define: { 'process.env.NODE_ENV': '"development"' },
	} );
	react = made.outputFiles[ 0 ].text;
} );

test.beforeEach( async ( { page } ) => {
	await page.route( '**/react-for-the-test.js', ( route ) =>
		route.fulfill( { contentType: 'text/javascript', body: react } )
	);
	await page.route( '**/ssr.html', ( route ) =>
		route.fulfill( {
			contentType: 'text/html',
			body: `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="/src/style.css">
<style>
	body { margin: 0; }
	main { display: grid; gap: 24px; padding: 16px; }
	/* A page says how large its slides are, as it does for any image. */
	#row .gs-slide { aspect-ratio: 4 / 5; }
	#stack .gs-slide { aspect-ratio: 16 / 9; }
</style>
<script type="importmap">{ "imports": { "react": "/react-for-the-test.js", "react-dom/client": "/react-for-the-test.js" } }</script>
<script>
	// What the server gave, before the script: where the slides are, and
	// every shift of the layout from here on.
	window.shifts = 0;
	new PerformanceObserver( ( list ) =>
		list.getEntries().forEach( ( entry ) => ( window.shifts += entry.value ) )
	).observe( { type: 'layout-shift', buffered: true } );
	// The slides in the view of their slider: one out of it may be placed
	// before the first, for the loop.
	window.where = () =>
		[ ...document.querySelectorAll( '.gs-slide' ) ].flatMap( ( slide ) => {
			const { x, y, width, height } = slide.getBoundingClientRect();
			const view = slide.closest( '.gs' ).getBoundingClientRect();
			return x + width > view.left + 1 && x < view.right - 1
				? [ [ x, y, width, height ].map( Math.round ) ]
				: [];
		} );
	addEventListener( 'DOMContentLoaded', () => ( window.before = window.where() ) );
</script>
</head>
<body>
<div id="root">${ html }</div>
<script type="module">
	import { createElement } from 'react';
	import { hydrateRoot } from 'react-dom/client';
	import { App } from '/tests/ssr-app.js';
	window.errors = [];
	hydrateRoot( document.getElementById( 'root' ), createElement( App ), {
		onRecoverableError: ( error ) => window.errors.push( error.message ),
	} );
</script>
</body>
</html>`,
		} )
	);
} );

test( 'the server renders the slider as the browser has it before the script', () => {
	expect( html ).toContain( 'class="gs"' );
	expect( html ).toContain( 'class="gs gs-stack"' );
	expect( html ).toContain( 'class="gs-track"' );
	expect( html.match( /class="gs-slide"/g ) ).toHaveLength( 10 );
	expect( html ).toContain( 'data-gs-next' );
} );

test( 'it hydrates without a mismatch, and nothing moves', async ( { page } ) => {
	const said = [];
	page.on( 'console', ( message ) => {
		if ( [ 'error', 'warning' ].includes( message.type() ) ) {
			said.push( message.text() );
		}
	} );
	page.on( 'pageerror', ( error ) => said.push( error.message ) );
	await page.goto( '/ssr.html' );
	// The canvas of the row comes at the first sign of use.
	await page.locator( '#row' ).hover();
	await page.mouse.move( 300, 200 );
	// Hydrated: the sliders are made, and the canvas is drawing.
	await page.waitForFunction( () =>
		[ 'row', 'stack' ].every( ( id ) =>
			document.getElementById( id ).classList.contains( 'gs-gl' )
		)
	);
	await page.waitForTimeout( 300 );
	expect( await page.evaluate( () => window.errors ) ).toEqual( [] );
	expect( said.filter( ( text ) => /hydrat|did not match|mismatch/i.test( text ) ) ).toEqual( [] );
	expect( await page.evaluate( () => window.where() ) ).toEqual(
		await page.evaluate( () => window.before )
	);
	expect( await page.evaluate( () => window.shifts ) ).toBe( 0 );
	// And it is a slider.
	const first = ( await page.evaluate( () => window.where() ) )[ 0 ];
	await page.locator( '#row [data-gs-next]' ).click();
	await expect
		.poll( () => page.evaluate( () => window.where()[ 0 ][ 0 ] ) )
		.toBeLessThan( first[ 0 ] );
} );
