/**
 * Sliders without a script of one's own: `auto.js` and `data-gs`.
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

test( 'every element with data-gs is a slider, with its options', async ( { page } ) => {
	expect( await page.evaluate( () => window.made ) ).toEqual( [
		'plain',
		'drawn',
	] );
	await expect( page.locator( '#plain' ) ).toHaveClass( /gs-on/ );
	await page.locator( '#plain [data-gs-next]' ).click();
	await expect( page.locator( '#plain .gs-slide' ).nth( 1 ) ).not.toHaveAttribute(
		'inert'
	);
	await expect( page.locator( '#plain .gs-slide' ).first() ).toHaveAttribute(
		'inert'
	);
	// start: 1
	await expect( page.locator( '#drawn .gs-slide' ).first() ).toHaveAttribute(
		'inert'
	);
} );

test( 'the canvas is loaded for the slider that asks for it, and for no other: the one the browser can draw', async ( { page } ) => {
	const loaded = [];
	// What the page before still loads is not counted.
	await page.goto( 'about:blank' );
	page.on( 'request', ( request ) => loaded.push( request.url() ) );
	await page.goto( `/tests/auto.html${ from }` );
	await page.waitForFunction( () => window.made.length === 2 );
	await page.locator( '#drawn' ).hover();
	await expect( page.locator( '#drawn canvas' ) ).toHaveCount( 1 );
	await expect( page.locator( '#plain canvas' ) ).toHaveCount( 0 );
	const can = await page.evaluate(
		async () => !! ( await navigator.gpu?.requestAdapter() )
	);
	const layers = [ ...new Set( loaded.flatMap( ( url ) =>
		/\/(gl|gpu)(\/index)?\.js/.exec( url )?.[ 1 ] || []
	) ) ];
	expect( layers ).toEqual( [ can ? 'gpu' : 'gl' ] );
	// An effect nobody knows is left out, the ones known are there.
	const names = await page.evaluate( async ( query ) => {
		const dir = query ? '../dist' : '../src';
		const { sliders: all } = await import( `${ dir }/auto.js` );
		const slider = all.get( document.getElementById( 'drawn' ) );
		return Object.keys( slider.plugins );
	}, from );
	expect( names ).toContain( can ? 'gpu' : 'gl' );
	expect( names ).toContain( 'lightbox' );
} );

test( 'a page without a canvas never loads it', async ( { page } ) => {
	const loaded = [];
	await page.route( '**/auto.html*', async ( route ) => {
		const response = await route.fetch();
		const body = ( await response.text() )
			.replace( /data-gs-canvas='[^']*'/, '' )
			.replace( 'data-gs-lightbox="stretch"', '' );
		await route.fulfill( { response, body } );
	} );
	await page.goto( 'about:blank' );
	page.on( 'request', ( request ) => loaded.push( request.url() ) );
	await page.goto( `/tests/auto.html${ from }` );
	await page.waitForFunction( () => window.made.length === 2 );
	await page.locator( '#drawn' ).hover();
	await page.waitForTimeout( 500 );
	expect( loaded.filter( ( url ) => /gl|gpu|lightbox\.js|chunks/.test( url ) ) ).toEqual( [] );
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
			.replace( / class="gs[^"]*"/, ' class="gs"' );
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

test( 'canvas() takes the layer the browser can draw, or the one it is told', async ( { page } ) => {
	const made = await page.evaluate( async ( query ) => {
		const dir = query ? '../dist' : '../src';
		const { canvas } = await import( `${ dir }/canvas.js` );
		const { createSlider } = await import( `${ dir }/index.js` );
		const { stretch } = await import( `${ dir }/effects.js` );
		const can = !! ( await navigator.gpu?.requestAdapter() );
		const names = [];
		for ( const layer of [ undefined, 'gl' ] ) {
			const root = document.getElementById( 'plain' ).cloneNode( true );
			root.id = `chosen-${ layer }`;
			root.removeAttribute( 'data-gs' );
			root.className = 'gs';
			document.body.prepend( root );
			const slider = createSlider( root, {
				plugins: [ canvas( { effects: [ stretch() ], layer, eager: true } ) ],
			} );
			names.push(
				await new Promise( ( done ) => slider.on( 'canvas:ready', done ) )
			);
			await new Promise( ( done ) => setTimeout( done, 800 ) );
			names.push( !! slider.plugins[ names.at( -1 ) ].canvas );
		}
		return { can, names };
	}, from );
	expect( made.names ).toEqual( [ made.can ? 'gpu' : 'gl', true, 'gl', true ] );
} );

test( 'a slider that asks for it has a screen while its media load', async ( { page } ) => {
	let come;
	const held = new Promise( ( resolve ) => {
		come = resolve;
	} );
	await page.route( /held=/, async ( route ) => {
		await held;
		await route.continue();
	} );
	await page.evaluate( async ( query ) => {
		const dir = query ? '../dist' : '../src';
		const { auto } = await import( `${ dir }/auto.js` );
		const later = document.getElementById( 'later' );
		later.innerHTML = document
			.getElementById( 'plain' )
			.outerHTML.replace( 'id="plain"', 'id="waits"' )
			.replace( / class="gs[^"]*"/, ' class="gs"' )
			.replace( 'data-gs', 'data-gs data-gs-loading=\'{ "min": 1 }\'' )
			.replaceAll( '.jpg', '.jpg?held=1' );
		auto( later );
	}, from );
	const screen = page.locator( '#waits .gs-loading' );
	await expect( screen ).toBeVisible();
	await expect( screen ).toHaveText( '0 %' );
	come();
	await expect( screen ).toHaveText( '100 %' );
	await expect( screen ).toBeHidden();
	// The others have none.
	await expect( page.locator( '.gs-loading' ) ).toHaveCount( 1 );
} );
