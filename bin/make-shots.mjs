/**
 * Takes the pictures of the examples that the site shows on its first
 * page and on the page of the examples: `site/public/shots/<name>.avif`.
 *
 * `node bin/make-shots.mjs [http://localhost:5183] [name …]`
 *
 * The site has to run: `npm run site`. The pictures are drawn by WebGPU,
 * in a browser without a window.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const base = process.argv[ 2 ] || 'http://localhost:5183';
const to = 'site/public/shots';
mkdirSync( to, { recursive: true } );

/** What is done to a page before its picture is taken. */
const PAGES = {
	// Dragged a little: the glass is seen where it bends.
	wall: async ( page ) => {
		await page.mouse.move( 700, 420 );
		await page.mouse.down();
		await page.mouse.move( 560, 330, { steps: 12 } );
		await page.mouse.up();
		await page.waitForTimeout( 1500 );
	},
	reel: async ( page ) => {
		await page.waitForTimeout( 1500 );
	},
	// The second row is in the middle of the picture.
	tape: async ( page ) => {
		await page.mouse.wheel( 0, 1000 );
		await page.waitForTimeout( 1500 );
	},
	loom: async ( page ) => {
		await page.waitForTimeout( 1500 );
	},
	// The first stage, its two bands running.
	wave: async ( page ) => {
		await page.waitForTimeout( 3000 );
	},
	// Moved on by one: the picture is seen where it hangs back.
	depth: async ( page ) => {
		await page.keyboard.press( 'Tab' );
		await page.evaluate( () => window.slider.next() );
		await page.waitForTimeout( 350 );
	},
	journal: async ( page ) => {
		await page.waitForTimeout( 500 );
	},
};

const browser = await chromium.launch( {
	args: [ '--enable-unsafe-webgpu', '--use-angle=metal' ],
} );
const only = process.argv.slice( 3 );
for ( const [ name, ready ] of Object.entries( PAGES ) ) {
	if ( only.length && ! only.includes( name ) ) {
		continue;
	}
	const page = await browser.newPage( {
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
	} );
	await page.goto( `${ base }/examples/${ name }/` );
	// The screen that waits for the pictures has gone.
	await page.waitForFunction(
		() => ! document.querySelector( '.gs-is-loading' ),
		null,
		{ timeout: 30000 }
	);
	await page.waitForTimeout( 2500 );
	await ready( page );
	await sharp( await page.screenshot() )
		.resize( 1280, 800 )
		.avif( { quality: 55 } )
		.toFile( `${ to }/${ name }.avif` );
	// eslint-disable-next-line no-console
	console.log( `${ to }/${ name }.avif` );
	await page.close();
}
await browser.close();
