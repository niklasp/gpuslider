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
	// Half way from one view to the next: the places turn one after
	// another.
	panes: async ( page ) => {
		await page.waitForTimeout( 1500 );
		await page.evaluate( () => window.slider.plugins.autoplay?.pause() );
		await page.waitForTimeout( 1700 );
		await page.getByRole( 'button', { name: 'Glyphs', exact: true } ).click();
		await page.getByRole( 'button', { name: 'From the middle', exact: true } ).click();
		await page.evaluate( () => {
			const r = document.querySelector( '.gallery' ).getBoundingClientRect();
			scrollTo( 0, r.top + scrollY - ( innerHeight - r.height ) / 2 );
			window.slider.next();
		} );
		await page.waitForTimeout( 420 );
	},
	// The first chapter, the cylinder turning.
	orbit: async ( page ) => {
		await page.waitForTimeout( 2500 );
	},
	// Scrolled to the cascade, half way in: its pictures fold into place.
	fold: async ( page ) => {
		await page.evaluate( () => {
			const r = document.querySelector( '#cascade .wall' ).getBoundingClientRect();
			scrollTo( 0, r.top + scrollY + r.height / 2 - innerHeight / 2 - 0.55 * innerHeight );
		} );
		await page.waitForTimeout( 1500 );
	},
	// The hero half resolved.
	resolve: async ( page ) => {
		await page.waitForTimeout( 1100 );
	},
	// A name pointed at, its picture half burnt open.
	reveal: async ( page ) => {
		const row = page.locator( '.row' ).nth( 2 );
		const r = await row.boundingBox();
		await page.mouse.move( r.x + r.width * 0.6, r.y + r.height / 2, { steps: 8 } );
		await page.waitForTimeout( 550 );
	},
	// Mid-jump: the photo comes in as a stream of frames.
	echo: async ( page ) => {
		await page.waitForTimeout( 1500 );
		await page.evaluate( () => window.slider.to( ( window.slider.index + 3 ) % 8 ) );
		await page.waitForTimeout( 140 );
	},
	// Scrolled a part of the way, as the first film flows into the next.
	reel: async ( page ) => {
		await page.waitForTimeout( 1500 );
		await page.evaluate( () => {
			document.documentElement.style.scrollSnapType = 'none';
			scrollTo( 0, innerHeight * 0.18 );
		} );
		await page.waitForTimeout( 800 );
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
