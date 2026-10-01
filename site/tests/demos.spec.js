/**
 * The pages of the site that are made of the library, and of little
 * else: a wall of images, a reel, tape. And what the playground shows of
 * what they are made of.
 */
import { test, expect } from '@playwright/test';

test.describe( 'the reel', () => {
	test.slow();

	test( 'a screen that is made of the events, then the first words', async ( { page } ) => {
		let come;
		const held = new Promise( ( resolve ) => {
			come = resolve;
		} );
		await page.route( /media\/dream\/(03|06)/, async ( route ) => {
			await held;
			await route.continue();
		} );
		await page.goto( '/examples/reel/', { waitUntil: 'domcontentloaded' } );
		const intro = page.locator( '#intro' );
		await expect( intro ).toBeVisible();
		await expect( page.locator( '#what' ) ).toHaveText( '6 pictures and films' );
		// Four of six are there, and the number runs to them.
		await expect( page.locator( '#count' ) ).toHaveText( '67', { timeout: 15000 } );
		await expect( page.locator( '[data-shown]' ) ).toHaveCount( 0 );
		// The page does not scroll while it waits.
		await expect( page.locator( 'html' ) ).toHaveClass( /held/ );
		come();
		await expect( page.locator( '#count' ) ).toHaveText( '100', { timeout: 15000 } );
		await expect( intro ).toBeHidden( { timeout: 15000 } );
		await expect( page.locator( '[data-shown] h2' ) ).toHaveText( 'Quiet Engine' );
		await expect( page.locator( 'html' ) ).not.toHaveClass( /held/ );
	} );

	test( 'the page goes down the reel, and the next picture brings its words', async ( { page } ) => {
		await page.goto( '/examples/reel/' );
		await expect( page.locator( '#intro' ) ).toBeHidden( { timeout: 30000 } );
		await page.getByRole( 'button', { name: 'Next' } ).click();
		await expect( page.locator( '[data-shown] h2' ) ).toHaveText( 'Salt Hour' );
		await expect( page.locator( '[data-shown]' ) ).toHaveCount( 1 );
		// The page is where the reel is, and the wheel takes both further.
		await expect
			.poll( () => page.evaluate( () => scrollY / innerHeight ) )
			.toBeCloseTo( 1, 1 );
		await page.mouse.move( 700, 400 );
		await page.mouse.wheel( 0, 900 );
		await expect( page.locator( '[data-shown] h2' ) ).toHaveText( 'Paper Weather' );
	} );
} );

test.describe( 'the tape', () => {
	test.slow();

	test( 'every row has the screen of the library, and they count together', async ( { page } ) => {
		let come;
		const held = new Promise( ( resolve ) => {
			come = resolve;
		} );
		await page.route( /media\/wall\/0/, async ( route ) => {
			await held;
			await route.continue();
		} );
		await page.goto( '/examples/tape/', { waitUntil: 'domcontentloaded' } );
		const screens = page.locator( '.gs-loading' );
		await expect( screens ).toHaveCount( 4 );
		await expect
			.poll( () =>
				page.evaluate( () => window.tapes?.[ 0 ].plugins.loading.state.loaded )
			)
			.toBeGreaterThan( 0 );
		const numbers = await screens.allTextContents();
		expect( new Set( numbers ).size ).toBe( 1 );
		expect( numbers[ 0 ] ).not.toBe( '100 %' );
		come();
		await expect( screens.first() ).toBeHidden( { timeout: 30000 } );
		await expect( screens.last() ).toBeHidden();
	} );

	test( 'the rows run against each other', async ( { page } ) => {
		await page.goto( '/examples/tape/' );
		await expect( page.locator( '.gs-loading' ).first() ).toBeHidden( {
			timeout: 30000,
		} );
		// A row runs while it is seen.
		const run = async ( i ) => {
			await page.locator( '.tape' ).nth( i ).scrollIntoViewIfNeeded();
			// What the scrolling pushed has come to rest.
			await page.waitForTimeout( 1200 );
			const place = () =>
				page.evaluate( ( n ) => window.tapes[ n ].motion.pos, i );
			const before = await place();
			await page.waitForTimeout( 600 );
			return ( await place() ) - before;
		};
		expect( await run( 0 ) ).toBeGreaterThan( 5 );
		expect( await run( 1 ) ).toBeLessThan( -5 );
	} );
} );

test.describe( 'the playground', () => {
	test.slow();

	test( 'it leads to the pages that are made of it, and to the docs', async ( { page } ) => {
		await page.goto( '/playground/' );
		const links = page.getByRole( 'navigation', {
			name: 'Pages that are made of it',
		} );
		await expect( links.getByRole( 'link' ) ).toHaveText( [
			'Resolve',
			'Reveal',
			'Orbit',
			'Echo',
			'Fold',
			'A reel',
			'Tape',
			'Loom',
			'Wave',
			'Depth',
			'Journal',
			'Docs',
		] );
		await links.getByRole( 'link', { name: 'Tape' } ).click();
		await expect( page ).toHaveURL( /\/examples\/tape\/$/ );
		await expect( page.locator( '.tape' ) ).toHaveCount( 4 );
		// An example leads back to the examples.
		await page.getByRole( 'link', { name: '← Examples' } ).click();
		await expect( page ).toHaveURL( /\/examples\/$/ );
		await expect(
			page.getByTestId( 'examples' ).getByRole( 'listitem' ).first()
		).toBeVisible();
	} );

	test( 'pictures that are loaded again have a screen, and say how far they are', async ( { page } ) => {
		let come;
		const held = new Promise( ( resolve ) => {
			come = resolve;
		} );
		await page.route( /again=/, async ( route ) => {
			await held;
			await route.continue();
		} );
		await page.goto( '/playground/' );
		await page.waitForFunction( () => window.sliders?.loads );
		const screen = page.locator( '#loads .gs-loading' );
		// Not with the page.
		await expect( screen ).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Load them again' } ).click();
		await expect( screen ).toBeVisible();
		await expect( screen ).toHaveText( '0 %' );
		const said = page.getByTestId( 'loaded' ).locator( 'li' );
		await expect( said.last() ).toHaveText( 'loading:start · 0 of 6' );
		come();
		await expect( screen ).toHaveText( '100 %' );
		await expect( screen ).toBeHidden();
		await expect( said.first() ).toContainText( 'loading:done · 6 of 6' );
	} );

	test( 'glass, jelly and a dome can be switched on', async ( { page } ) => {
		const logged = [];
		page.on( 'console', ( message ) => {
			if ( message.type() === 'error' ) {
				logged.push( message.text() );
			}
		} );
		await page.goto( '/playground/' );
		await page.getByRole( 'switch', { name: 'Canvas' } ).waitFor();
		for ( const name of [ 'Glass', 'Jelly', 'Dome' ] ) {
			await page.getByRole( 'button', { name, exact: true } ).click();
		}
		const slider = page.locator( '#several' );
		await slider.scrollIntoViewIfNeeded();
		const box = await slider.boundingBox();
		await page.mouse.move( box.x + box.width / 2, box.y + box.height / 2 );
		await expect( page.locator( '#several .gs-drawn' ).first() ).toBeAttached( {
			timeout: 15000,
		} );
		expect( logged ).toEqual( [] );
	} );
} );
