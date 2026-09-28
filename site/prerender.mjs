/**
 * After the build: writes the page into `dist/index.html` as HTML.
 *
 * - The markup of the page, rendered by React on the server.
 * - The styles in the document: one request less before the first paint.
 * - The script after what the first paint needs.
 *
 * `npm run build` does this.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve( import.meta.dirname, 'dist' );
const { render } = await import(
	pathToFileURL( resolve( dist, 'server/entry-server.js' ) ).href
);

let html = readFileSync( resolve( dist, 'index.html' ), 'utf8' );
const markup = await render();
html = html.replace( '<div id="root"></div>', `<div id="root">${ markup }</div>` );

// Styles into the document.
html = html.replace(
	/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/,
	( _, file ) =>
		`<style>${ readFileSync( resolve( dist, file ), 'utf8' ).replaceAll(
			'url(/assets/',
			'url(/assets/'
		) }</style>`
);

// The page is there without its script, so the script gives way to what
// the first paint shows: the image and the font.
//
// Hints that ask for the font or for the script of the controls with the
// document were tried and taken out again: on a slow connection they take
// from the document and the first image what these need more (first paint
// 1.8 s with them, 1.4 s without, measured by Lighthouse).
html = html.replace(
	'<script type="module"',
	'<script type="module" fetchpriority="low"'
);

writeFileSync( resolve( dist, 'index.html' ), html );
rmSync( resolve( dist, 'server' ), { recursive: true } );
// eslint-disable-next-line no-console
console.log( `dist/index.html: ${ Math.round( html.length / 1024 ) } KB with the page in it` );
