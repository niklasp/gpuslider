/**
 * The demos: pages that are made of the library, and of little else.
 */
import { test, expect } from '@playwright/test';

test.describe( 'the wall', () => {
	// Five canvases as wide as the screen: without a GPU that takes time.
	test.slow();
	const gone = { timeout: 30000 };
	const places = ( page ) =>
		page.evaluate( () => ( {
			wall: window.wall.wall.motion.pos,
			rows: window.wall.rows.map( ( { slider } ) => slider.motion.pos ),
		} ) );
	const resting = ( page ) =>
		page.waitForFunction( () => window.wall?.wall.resting );

	test( 'a screen while the pictures load, then the wall', async ( { page } ) => {
		let come;
		const held = new Promise( ( resolve ) => {
			come = resolve;
		} );
		await page.route( /wall\/media\/0/, async ( route ) => {
			await held;
			await route.continue();
		} );
		// The page is not loaded before its pictures are.
		await page.goto( '/demo/wall/', { waitUntil: 'domcontentloaded' } );
		const intro = page.locator( '#intro' );
		await expect( intro ).toBeVisible();
		await expect( page.locator( '#wall' ) ).toHaveClass( /ss-is-loading/ );
		// The pictures that are held back are missing.
		await expect
			.poll( () =>
				page.evaluate( () => window.wall?.wall.plugins.loading.state.loaded )
			)
			.toBeGreaterThan( 0 );
		expect( Number( await intro.locator( '[data-ss-loaded]' ).textContent() ) ).toBeLessThan( 100 );
		come();
		await expect( intro ).toHaveClass( /ss-loaded/, gone );
		await expect( intro ).toBeHidden( gone );
		await expect( page.locator( '#wall' ) ).not.toHaveClass( /ss-is-loading/ );
		expect(
			await page.evaluate( () => window.wall.wall.plugins.loading.state )
		).toEqual( { loaded: 56, failed: 0, total: 56, progress: 1 } );
	} );

	test( 'the canvas draws the rows that are seen', async ( { page } ) => {
		const logged = [];
		page.on( 'console', ( message ) => {
			if ( message.type() === 'error' ) {
				logged.push( message.text() );
			}
		} );
		await page.goto( '/demo/wall/' );
		await expect
			.poll(
				() => page.evaluate( () => document.querySelectorAll( '.ss-drawn' ).length ),
				{ timeout: 15000 }
			)
			.toBeGreaterThan( 20 );
		// The best the browser has, which no test has chosen.
		await expect( page.locator( '#said' ) ).toContainText(
			process.env.LAYER === 'gpu' ? 'WebGPU' : /WebGPU|WebGL/
		);
		expect( logged ).toEqual( [] );
	} );

	test( 'a drag moves it both ways, and every row as far as the others', async ( { page } ) => {
		await page.goto( '/demo/wall/' );
		await expect( page.locator( '#intro' ) ).toBeHidden( gone );
		await resting( page );
		const before = await places( page );
		await page.mouse.move( 700, 400 );
		await page.mouse.down();
		for ( let i = 1; i <= 10; i++ ) {
			await page.mouse.move( 700 - i * 20, 400 - i * 10 );
		}
		// Held, and at rest under the pointer: no ticker moves it.
		await page.waitForTimeout( 200 );
		const held = await places( page );
		await page.mouse.up();
		expect( held.wall - before.wall ).toBeCloseTo( 100, 0 );
		const moved = held.rows.map( ( pos, i ) => pos - before.rows[ i ] );
		// The rows go on by themselves, each as fast as it likes, until
		// they are held.
		for ( const by of moved ) {
			expect( by ).toBeGreaterThan( 199 );
			expect( by ).toBeLessThan( 215 );
		}
	} );

	test( 'the wheel and the keys move it', async ( { page } ) => {
		await page.goto( '/demo/wall/' );
		await expect( page.locator( '#intro' ) ).toBeHidden( gone );
		await resting( page );
		const before = await places( page );
		await page.mouse.move( 700, 400 );
		await page.mouse.wheel( 0, 300 );
		await expect
			.poll( async () => ( await places( page ) ).wall - before.wall )
			.toBeGreaterThan( 250 );
		await resting( page );
		const then = await places( page );
		await page.locator( '#wall' ).focus();
		await page.keyboard.press( 'ArrowRight' );
		await expect
			.poll( async () => ( await places( page ) ).rows[ 0 ] - then.rows[ 0 ] )
			.toBeGreaterThan( 200 );
	} );

	test( 'without the script it is a page of rows that scroll', async ( { browser } ) => {
		const context = await browser.newContext( { javaScriptEnabled: false } );
		const page = await context.newPage();
		await page.goto( '/demo/wall/' );
		await expect( page.locator( '#intro' ) ).toBeHidden( gone );
		await expect( page.locator( '.row' ) ).toHaveCount( 7 );
		await expect( page.locator( '.row img' ).first() ).toBeVisible();
		await context.close();
	} );
} );
