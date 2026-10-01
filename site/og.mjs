/**
 * Writes the pictures that a link to a page shows where it is shared,
 * `public/og/<page>.jpg`, 1200 by 630: the page itself, taken from the
 * build that `npx vite preview --port 5199` serves.
 *
 * `node og.mjs`
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const out = resolve( import.meta.dirname, 'public/og' );
mkdirSync( out, { recursive: true } );

const PAGES = {
	home: '/',
	docs: '/docs/',
	examples: '/examples/',
	playground: '/playground/',
	reel: '/examples/reel/',
	tape: '/examples/tape/',
	loom: '/examples/loom/',
	wave: '/examples/wave/',
	depth: '/examples/depth/',
	journal: '/examples/journal/',
	orbit: '/examples/orbit/',
	fold: '/examples/fold/',
	resolve: '/examples/resolve/',
	reveal: '/examples/reveal/',
	echo: '/examples/echo/',
};
// The stages of the wave and the stories of the journal: each its own.
for ( const stage of [ 'curves', 'crossing', 'depth', 'vortex' ] ) {
	PAGES[ `wave-${ stage }` ] = `/examples/wave/${ stage }/`;
}
for ( const story of [
	'between-the-letters',
	'blue-hour',
	'laser-set',
	'last-credit',
	'lost-in-red',
	'sound-check',
	'storm-indoors',
] ) {
	PAGES[ `journal-${ story }` ] = `/examples/journal/${ story }/`;
}

const browser = await chromium.launch( { args: [ '--use-angle=metal' ] } );
const page = await browser.newPage( {
	viewport: { width: 1200, height: 630 },
	deviceScaleFactor: 1,
	reducedMotion: 'no-preference',
} );
for ( const [ name, path ] of Object.entries( PAGES ) ) {
	await page.goto( `http://localhost:5199${ path }`, { waitUntil: 'load' } );
	await page.waitForTimeout( 3500 );
	const shot = await page.screenshot();
	await sharp( shot )
		.jpeg( { quality: 82, mozjpeg: true } )
		.toFile( resolve( out, `${ name }.jpg` ) );
	// eslint-disable-next-line no-console
	console.log( `og/${ name }.jpg` );
}
await browser.close();
