/**
 * `loading()`: waits for the media, shows a screen, says how far it is.
 */
import { test, expect } from '@playwright/test';

/**
 * Opens the page with media that come when the test lets them.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @return {Promise<Function>} Lets media through: those whose name is
 *                             given, or all; `fail` instead of a name's
 *                             media breaks them.
 */
async function open( page ) {
	const held = new Map();
	const free = new Set();
	await page.route( /held=/, ( route ) => {
		const name = new URL( route.request().url() ).searchParams.get( 'held' );
		if ( free.has( name ) || free.has( '*' ) ) {
			return route.continue();
		}
		held.set( name, [ ...( held.get( name ) || [] ), route ] );
	} );
	const query = process.env.FROM ? `?from=${ process.env.FROM }` : '';
	await page.goto( `/tests/loading.html${ query }` );
	await page.waitForFunction( () => window.ready );
	return async ( name = '*', fail = false ) => {
		free.add( name );
		for ( const [ key, routes ] of held ) {
			if ( name === '*' || name === key ) {
				held.delete( key );
				for ( const route of routes ) {
					await ( fail ? route.abort() : route.continue() );
				}
			}
		}
	};
}

const heard = ( page ) => page.evaluate( () => window.heard );
const names = async ( page ) =>
	( await heard( page ) ).map( ( [ , name ] ) => name );

test( 'the screen is there while the media load, and says how far they are', async ( { page } ) => {
	const let_ = await open( page );
	await page.evaluate( () => window.make( 'one', window.loading() ) );
	const screen = page.locator( '#one .ss-loading' );
	await expect( screen ).toBeVisible();
	await expect( screen ).toHaveAttribute( 'role', 'progressbar' );
	await expect( screen ).toHaveAttribute( 'aria-valuenow', '0' );
	await expect( screen ).toHaveText( '0 %' );
	await expect( page.locator( '#one' ) ).toHaveClass( /ss-is-loading/ );
	// It covers the slider.
	const [ box, all ] = [
		await screen.boundingBox(),
		await page.locator( '#one' ).boundingBox(),
	];
	expect( box ).toEqual( all );

	await let_( '1' );
	await expect( screen ).toHaveAttribute( 'aria-valuenow', '33' );
	await expect( screen ).toHaveText( '33 %' );
	expect(
		await screen.evaluate( ( element ) =>
			Number( element.style.getPropertyValue( '--ss-loaded' ) ).toFixed( 2 )
		)
	).toBe( '0.33' );
	await let_( '2' );
	await expect( screen ).toHaveText( '67 %' );
	// The third waits for its place to come near: it is told to load.
	await let_( '3' );
	await expect( screen ).toHaveText( '100 %' );
	await expect( screen ).toHaveClass( /ss-loaded/ );
	await expect( screen ).toBeHidden();
	await expect( page.locator( '#one' ) ).not.toHaveClass( /ss-is-loading/ );
	expect(
		await page.evaluate( () => {
			const { state, done } = window.sliders.one.plugins.loading;
			return { ...state, done };
		} )
	).toEqual( { loaded: 3, failed: 0, total: 3, progress: 1, done: true } );
} );

test( 'it says what happens, in its order', async ( { page } ) => {
	const let_ = await open( page );
	await page.evaluate( () => {
		window.kept = false;
		window
			.make( 'one', window.loading( { screen: false } ) )
			.plugins.loading.ready.then( () => {
				window.kept = true;
			} );
	} );
	await expect( page.locator( '.ss-loading' ) ).toHaveCount( 0 );
	await expect.poll( () => names( page ) ).toEqual( [ 'loading:start' ] );
	expect( ( await heard( page ) )[ 0 ][ 2 ] ).toEqual( {
		loaded: 0,
		failed: 0,
		total: 3,
		progress: 0,
	} );
	await let_( '2' );
	await expect.poll( async () => ( await names( page ) ).length ).toBe( 2 );
	await let_( '1', true );
	await expect.poll( async () => ( await names( page ) ).length ).toBe( 3 );
	await let_();
	await expect
		.poll( () => names( page ) )
		.toEqual( [
			'loading:start',
			'loading:progress',
			'loading:progress',
			'loading:progress',
			'loading:done',
		] );
	const said = ( await heard( page ) ).map( ( [ , , detail ] ) => detail );
	expect( said[ 1 ] ).toMatchObject( { loaded: 1, failed: 0, total: 3 } );
	// What fails counts, and is told.
	expect( said[ 2 ] ).toMatchObject( { loaded: 1, failed: 1, total: 3 } );
	expect( said[ 4 ] ).toMatchObject( {
		loaded: 2,
		failed: 1,
		total: 3,
		progress: 1,
		late: false,
	} );
	expect( said[ 4 ].time ).toBeGreaterThan( 0 );
	expect( await page.evaluate( () => window.kept ) ).toBe( true );
} );

test( 'a video counts when its first picture is there', async ( { page } ) => {
	const let_ = await open( page );
	await page.evaluate( () => window.make( 'two', window.loading() ) );
	const screen = page.locator( '#two .ss-loading' );
	await let_( '4' );
	await expect( screen ).toHaveText( '50 %' );
	await let_( 'a' );
	await expect( screen ).toHaveText( '100 %' );
	expect(
		await page.evaluate(
			() => document.querySelector( '#two video' ).readyState
		)
	).toBeGreaterThan( 1 );
} );

test( 'after its time it is done with what is there', async ( { page } ) => {
	const let_ = await open( page );
	await page.evaluate( () =>
		window.make( 'one', window.loading( { timeout: 300 } ) )
	);
	await let_( '1' );
	await expect( page.locator( '#one .ss-loading' ) ).toBeHidden();
	const last = ( await heard( page ) ).at( -1 );
	expect( last[ 1 ] ).toBe( 'loading:done' );
	expect( last[ 2 ] ).toMatchObject( { loaded: 1, total: 3, late: true } );
	// What comes later changes nothing.
	await let_();
	await page.waitForTimeout( 200 );
	expect( ( await heard( page ) ).at( -1 )[ 1 ] ).toBe( 'loading:done' );
} );

test( 'the screen stays for the least time it is given', async ( { page } ) => {
	const let_ = await open( page );
	await let_();
	const began = Date.now();
	await page.evaluate( () =>
		window.make( 'one', window.loading( { min: 700 } ) )
	);
	const screen = page.locator( '#one .ss-loading' );
	await expect( screen ).toHaveText( '100 %' );
	await expect( screen ).not.toHaveClass( /ss-loaded/ );
	await expect( screen ).toHaveClass( /ss-loaded/ );
	expect( Date.now() - began ).toBeGreaterThan( 650 );
} );

test( 'a screen of the page, for two sliders that count together', async ( { page } ) => {
	const let_ = await open( page );
	await page.evaluate( () => {
		const together = window.loading( {
			screen: document.getElementById( 'own' ),
			also: [
				new Promise( ( resolve ) => {
					window.more = resolve;
				} ),
			],
		} );
		window.make( 'one', together );
		window.make( 'two', together );
	} );
	const own = page.locator( '#own' );
	await expect( page.locator( '.ss-loading' ) ).toHaveCount( 0 );
	await expect( own ).toHaveText( '0' );
	await expect
		.poll( async () => ( await heard( page ) ).map( ( [ id, , { total } ] ) => [ id, total ] ) )
		.toEqual( [
			[ 'one', 6 ],
			[ 'two', 6 ],
		] );
	await let_();
	await expect( own ).toHaveText( '83' );
	await expect( own ).not.toHaveClass( /ss-loaded/ );
	await page.evaluate( () => window.more() );
	await expect( own ).toHaveText( '100' );
	await expect( own ).toHaveClass( /ss-loaded/ );
	await expect( page.locator( '#two' ) ).not.toHaveClass( /ss-is-loading/ );
} );

test( 'a screen that is in the page is taken, and stays when the slider ends', async ( { page } ) => {
	const let_ = await open( page );
	await page.evaluate( () => {
		document
			.getElementById( 'one' )
			.insertAdjacentHTML(
				'beforeend',
				'<div class="ss-loading" aria-label="Photos are coming"><b data-ss-loaded></b></div>'
			);
		window.make( 'one', window.loading() );
	} );
	const screen = page.locator( '#one .ss-loading' );
	await expect( screen ).toHaveCount( 1 );
	await expect( screen ).toHaveAttribute( 'aria-label', 'Photos are coming' );
	await let_( '1' );
	await expect( screen.locator( 'b' ) ).toHaveText( '33' );
	await page.evaluate( () => window.sliders.one.destroy() );
	await expect( screen ).toHaveCount( 1 );
	await expect( page.locator( '#one' ) ).not.toHaveClass( /ss-is-loading/ );
} );

test( 'a slider without media is done at once', async ( { page } ) => {
	await open( page );
	await page.evaluate( () => {
		document.querySelector( '#one .ss-track' ).innerHTML =
			'<div class="ss-slide">Text</div>';
		window.make( 'one', window.loading() );
	} );
	await expect
		.poll( () => names( page ) )
		.toEqual( [ 'loading:start', 'loading:done' ] );
	await expect( page.locator( '#one .ss-loading' ) ).toBeHidden();
} );
