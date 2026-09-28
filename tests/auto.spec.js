/**
 * Sliders without a script of one's own: `auto.js` and `data-ss`.
 */
import { test, expect } from '@playwright/test';

const from = process.env.FROM ? `?from=${ process.env.FROM }` : '';
const sliders = ( page ) =>
	page.evaluate( async ( query ) => {
		const dir = query ? '../dist' : '../src';
		return ( await import( `${ dir }/auto.js` ) ).sliders;
	}, from );

test.beforeEach( async ( { page } ) => {
	await page.goto( `/tests/auto.html${ from }` );
	await page.waitForFunction( () => window.made.length === 2 );
} );

test( 'every element with data-ss is a slider, with its options', async ( { page } ) => {
	expect( await page.evaluate( () => window.made ) ).toEqual( [
		'plain',
		'drawn',
	] );
	await expect( page.locator( '#plain' ) ).toHaveClass( /ss-on/ );
	await page.locator( '#plain [data-ss-next]' ).click();
	await expect( page.locator( '#plain .ss-slide' ).nth( 1 ) ).not.toHaveAttribute(
		'inert'
	);
	await expect( page.locator( '#plain .ss-slide' ).first() ).toHaveAttribute(
		'inert'
	);
	// start: 1
	await expect( page.locator( '#drawn .ss-slide' ).first() ).toHaveAttribute(
		'inert'
	);
} );

test( 'the canvas is loaded for the slider that asks for it, and for no other', async ( { page } ) => {
	const loaded = [];
	// What the page before still loads is not counted.
	await page.goto( 'about:blank' );
	page.on( 'request', ( request ) => loaded.push( request.url() ) );
	await page.goto( `/tests/auto.html${ from }` );
	await page.waitForFunction( () => window.made.length === 2 );
	await page.locator( '#drawn' ).hover();
	await expect( page.locator( '#drawn canvas' ) ).toHaveCount( 1 );
	await expect( page.locator( '#plain canvas' ) ).toHaveCount( 0 );
	expect( loaded.some( ( url ) => /\/gl(\/index)?\.js/.test( url ) ) ).toBe( true );
	// An effect nobody knows is left out, the ones known are there.
	const names = await page.evaluate( async ( query ) => {
		const dir = query ? '../dist' : '../src';
		const { sliders: all } = await import( `${ dir }/auto.js` );
		const slider = all.get( document.getElementById( 'drawn' ) );
		return Object.keys( slider.plugins );
	}, from );
	expect( names ).toContain( 'gl' );
	expect( names ).toContain( 'lightbox' );
} );

test( 'a page without a canvas never loads it', async ( { page } ) => {
	const loaded = [];
	await page.route( '**/auto.html*', async ( route ) => {
		const response = await route.fetch();
		const body = ( await response.text() )
			.replace( /data-ss-gl='[^']*'/, '' )
			.replace( 'data-ss-lightbox="stretch"', '' );
		await route.fulfill( { response, body } );
	} );
	await page.goto( 'about:blank' );
	page.on( 'request', ( request ) => loaded.push( request.url() ) );
	await page.goto( `/tests/auto.html${ from }` );
	await page.waitForFunction( () => window.made.length === 2 );
	await page.locator( '#drawn' ).hover();
	await page.waitForTimeout( 500 );
	expect( loaded.filter( ( url ) => /gl|lightbox\.js|chunks/.test( url ) ) ).toEqual( [] );
	if ( from ) {
		// One file of script for the whole page.
		expect( loaded.filter( ( url ) => url.endsWith( '.js' ) ) ).toHaveLength( 1 );
	}
} );

test( 'what comes later is made when asked for', async ( { page } ) => {
	await page.evaluate( async ( query ) => {
		const dir = query ? '../dist' : '../src';
		const { auto } = await import( `${ dir }/auto.js` );
		const later = document.getElementById( 'later' );
		later.innerHTML = document
			.getElementById( 'plain' )
			.outerHTML.replace( 'id="plain"', 'id="second"' )
			.replace( / class="ss[^"]*"/, ' class="ss"' );
		auto( later );
		auto();
	}, from );
	expect( await page.evaluate( () => window.made ) ).toEqual( [
		'plain',
		'drawn',
		'second',
	] );
	expect( typeof ( await sliders( page ) ) ).toBe( 'object' );
} );
