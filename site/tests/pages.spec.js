/**
 * The pages of the site that say what the library is: the first page,
 * the examples, the docs.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const read = ( file ) =>
	JSON.parse( readFileSync( new URL( `../src/lib/${ file }`, import.meta.url ) ) );
const kb = ( bytes ) => ( bytes / 1024 ).toFixed( 1 );

const DOCS = [
	[ '/docs/', 'Get started' ],
	[ '/docs/html/', 'Without a script' ],
	[ '/docs/react/', 'React' ],
	[ '/docs/layout/', 'Layout' ],
	[ '/docs/options/', 'Options, API and events' ],
	[ '/docs/plugins/', 'Plugins' ],
	[ '/docs/canvas/', 'The canvas' ],
	[ '/docs/effects/', 'Effects and transitions' ],
	[ '/docs/lightbox/', 'Lightbox' ],
	[ '/docs/loading/', 'Loading' ],
	[ '/docs/size/', 'Size, and what is not there yet' ],
];

/** What the console of a page said that should not be said. */
const errors = ( page ) => {
	const said = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' ) {
			said.push( message.text() );
		}
	} );
	page.on( 'pageerror', ( error ) => said.push( error.message ) );
	return said;
};

/**
 * Points at a slider and waits for its canvas. The pointer goes on moving,
 * as a hand does: a slider that is made again hears it when it is there.
 */
async function drawn( page, id ) {
	const slider = page.locator( `#${ id }` );
	await slider.scrollIntoViewIfNeeded();
	const box = await slider.boundingBox();
	let moved = 0;
	await expect
		.poll(
			async () => {
				await page.mouse.move(
					box.x + box.width / 2 + ( moved++ % 10 ),
					box.y + box.height / 2
				);
				return slider.locator( '.ss-drawn' ).count();
			},
			{ timeout: 15000 }
		)
		.toBeGreaterThan( 0 );
}

/** Where the links of a page lead that stay on the site. */
const links = ( page, within ) =>
	page
		.locator( `${ within } a[href]` )
		.evaluateAll( ( all ) => [
			...new Set(
				all
					.map( ( link ) => link.getAttribute( 'href' ) )
					.filter( ( href ) => /^[/#]/.test( href ) )
			),
		] );

/** Whether there is what a link of the site leads to. */
async function leads( page, href ) {
	const [ address, id ] = href.split( '#' );
	if ( address ) {
		const response = await page.goto( address );
		expect( response.status(), href ).toBe( 200 );
	}
	if ( id ) {
		await expect( page.locator( `[id="${ id }"]` ), href ).toHaveCount( 1 );
	}
}

test.describe( 'the first page', () => {
	test.slow();

	test.beforeEach( async ( { page } ) => {
		await page.goto( '/' );
		await page.waitForFunction( () => window.sliders?.first );
	} );

	test( 'says what the library is, and leads on', async ( { page } ) => {
		await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText(
			'A slider drawn by shaders.'
		);
		await expect(
			page.getByRole( 'navigation', { name: 'Pages', exact: true } ).getByRole( 'link' )
		).toHaveText( [ 'Docs', 'Examples', 'Playground' ] );
		const on = page.getByRole( 'navigation', { name: 'Where to go from here' } );
		await expect( on.getByRole( 'link' ) ).toHaveText( [
			'Get started',
			'Examples',
			'Playground',
		] );
		await on.getByRole( 'link', { name: 'Get started' } ).click();
		await expect( page ).toHaveURL( /\/docs\/$/ );
		await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Get started' );
	} );

	test( 'its numbers are the ones that were measured', async ( { page } ) => {
		const { parts } = read( 'sizes.json' );
		const [ chromium ] = read( 'bench.json' ).browsers;
		const numbers = page.getByTestId( 'numbers' ).getByRole( 'listitem' );
		await expect( numbers ).toHaveCount( 6 );
		await expect( numbers.first() ).toContainText( `${ kb( parts.core ) }KB` );
		const second = chromium.until.find(
			( one ) => one.layer === 'gpu' && one.effects === 'stretch,waves'
		).second;
		await expect( numbers.nth( 2 ) ).toContainText( `${ Math.round( second ) }ms` );

		await expect( page.getByTestId( 'sizes' ).getByRole( 'listitem' ).first() ).toContainText(
			`${ kb( parts.core ) } KB`
		);
		const measured = page.getByTestId( 'measured' );
		await expect( measured.getByRole( 'row' ) ).toHaveCount( 8 );
		await expect(
			measured.getByRole( 'row', { name: /the canvas draws/ } )
		).toContainText( '12' );
		await expect(
			measured.getByRole( 'row', { name: /The layer in the bundle/ } )
		).toContainText( `${ kb( parts[ 'canvas layer of WebGPU, no effects' ] ) } KB` );
	} );

	test( 'every feature leads to a page of the docs that is there', async ( { page } ) => {
		const features = page.getByTestId( 'features' ).getByRole( 'listitem' );
		await expect( features ).toHaveCount( 12 );
		const all = await links( page, '[data-testid="features"]' );
		expect( all.length ).toBeGreaterThan( 8 );
		for ( const href of all ) {
			expect( href ).toMatch( /^\/docs\// );
			await leads( page, href );
		}
	} );

	test( 'every link of the page leads somewhere', async ( { page } ) => {
		for ( const href of await links( page, 'body' ) ) {
			await page.goto( '/' );
			await leads( page, href );
		}
	} );

	test( 'the slider at the top is drawn by the canvas', async ( { page } ) => {
		const said = errors( page );
		await drawn( page, 'first' );
		expect(
			await page.evaluate( () => Object.keys( window.sliders.first.plugins ) )
		).toContain( process.env.LAYER === 'gpu' ? 'gpu' : 'gl' );
		// Under it: who draws it.
		await expect( page.locator( '#first + p' ) ).toContainText(
			process.env.LAYER === 'gpu' ? 'drawn by WebGPU' : 'drawn by WebGL'
		);
		expect( said ).toEqual( [] );
	} );

	test( 'a transition that is chosen is the one of the stack', async ( { page } ) => {
		const said = errors( page );
		const choice = page.getByRole( 'group', { name: 'Transition' } );
		await expect( choice.getByRole( 'button', { name: 'liquid' } ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		await choice.getByRole( 'button', { name: 'burn' } ).click();
		await expect( page.locator( '#turns' ) ).toHaveAttribute( 'data-made', 'burn' );
		await expect( choice.getByRole( 'button', { name: 'burn' } ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		await page.waitForFunction(
			() => window.sliders.turns.root.dataset.made === 'burn'
		);
		expect(
			await page.evaluate( () => Object.keys( window.sliders.turns.plugins ) )
		).toEqual( expect.arrayContaining( [ 'stack', 'autoplay' ] ) );
		await drawn( page, 'turns' );
		expect( said ).toEqual( [] );
	} );

	test( 'the ways to use it are the ones of the README', async ( { page } ) => {
		const code = page.getByRole( 'tabpanel' );
		await expect( code ).toContainText( `import { createSlider } from 'shaderslide';` );
		await page.getByRole( 'tab', { name: 'React' } ).click();
		await expect( code ).toContainText( 'useSlider(' );
		await page.getByRole( 'tab', { name: 'No script of your own' } ).click();
		await expect( code ).toContainText( 'data-ss-canvas="stretch waves"' );
	} );
} );

test.describe( 'the examples', () => {
	test( 'there are three, with a picture each, and they lead to their pages', async ( { page } ) => {
		await page.goto( '/examples/' );
		const all = page.getByTestId( 'examples' ).locator( '> li' );
		await expect( all ).toHaveCount( 3 );
		await expect( all.getByRole( 'heading' ) ).toHaveText( [
			'A wall of glass',
			'A reel',
			'Tape',
		] );
		for ( const name of [ 'wall', 'reel', 'tape' ] ) {
			const picture = page.locator( `img[src="/shots/${ name }.avif"]` );
			await picture.scrollIntoViewIfNeeded();
			await expect
				.poll( () => picture.evaluate( ( img ) => img.naturalWidth ) )
				.toBe( 1280 );
		}
		await all
			.nth( 1 )
			.getByRole( 'link', { name: 'Drawn by WebGL' } )
			.click();
		await expect( page ).toHaveURL( /\/examples\/reel\/\?layer=gl$/ );
		await expect( page.locator( '#said, header' ).first() ).toContainText(
			'WebGL',
			{ timeout: 20000 }
		);
	} );

	test( 'the first page shows them too', async ( { page } ) => {
		await page.goto( '/' );
		const all = page.getByTestId( 'examples' ).locator( '> li' );
		await expect( all ).toHaveCount( 3 );
		await all.first().getByRole( 'link' ).first().click();
		await expect( page ).toHaveURL( /\/examples\/wall\/$/ );
	} );
} );

test.describe( 'the docs', () => {
	for ( const [ address, title ] of DOCS ) {
		test( `${ address } is a page: ${ title }`, async ( { page } ) => {
			const said = errors( page );
			const response = await page.goto( address );
			expect( response.status() ).toBe( 200 );
			await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( title );
			await expect( page ).toHaveTitle( `${ title } · Docs · shaderslide` );
			await expect(
				page
					.getByRole( 'navigation', { name: 'Pages of the docs' } )
					.locator( '[aria-current="page"]' )
			).toHaveText( title );
			expect(
				( await page.getByTestId( 'text' ).innerText() ).length
			).toBeGreaterThan( 300 );
			// What it links to is there.
			for ( const href of await links( page, '[data-testid="text"], .here' ) ) {
				await page.goto( address );
				await leads( page, href );
			}
			expect( said ).toEqual( [] );
		} );
	}

	test( 'they have as many pages as their list says', async ( { page } ) => {
		await page.goto( '/docs/' );
		await expect(
			page
				.getByRole( 'navigation', { name: 'Pages of the docs' } )
				.getByRole( 'link' )
		).toHaveText( DOCS.map( ( [ , title ] ) => title ) );
		// From one to the next, to the last.
		for ( const [ , title ] of DOCS.slice( 1 ) ) {
			await page.locator( 'a[rel="next"]' ).click();
			await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( title );
		}
		await expect( page.locator( 'a[rel="next"]' ) ).toHaveCount( 0 );
	} );

	test( 'a page that is not there is not found', async ( { page } ) => {
		const response = await page.goto( '/docs/nothing/' );
		expect( response.status() ).toBe( 404 );
	} );

	test( 'what they say is what the README says', async ( { page } ) => {
		const readme = readFileSync( new URL( '../../README.md', import.meta.url ), 'utf8' );
		await page.goto( '/docs/options/' );
		const text = page.getByTestId( 'text' );
		await expect( text.getByRole( 'heading', { level: 2 } ) ).toHaveText( [
			'Options',
			'API',
			'Events',
		] );
		// Every option of the table of the README is in the table here.
		const options = /## Options\n([\s\S]*?)\n## /
			.exec( readme )[ 1 ]
			.match( /^\| `[^|]+/gm )
			.map( ( row ) => row.slice( 2 ).replaceAll( '`', '' ).trim() );
		expect( options.length ).toBeGreaterThan( 15 );
		const cells = await text.locator( 'tbody th' ).allInnerTexts();
		for ( const option of options ) {
			expect( cells.map( ( cell ) => cell.trim() ) ).toContain( option );
		}
		// Code has its colours.
		await expect( text.locator( 'pre .s' ).first() ).toBeVisible();
	} );

	test( 'the effects can be tried where they are said', async ( { page } ) => {
		test.slow();
		const said = errors( page );
		await page.goto( '/docs/effects/' );
		await page.waitForFunction( () => window.sliders?.row && window.sliders.turns );
		const demo = page.getByTestId( 'demo' );
		await demo.getByRole( 'button', { name: 'jelly', exact: true } ).click();
		await expect( page.locator( '#row' ) ).toHaveAttribute(
			'data-made',
			'stretch,split,jelly waves'
		);
		await drawn( page, 'row' );
		// All transitions of the library.
		const { parts } = read( 'sizes.json' );
		const transitions = Object.keys( parts ).filter( ( name ) =>
			name.startsWith( 'transition: ' )
		);
		await expect(
			demo
				.getByRole( 'group', { name: /Transitions/ } )
				.getByRole( 'button' )
		).toHaveCount( transitions.length );
		await demo.getByRole( 'button', { name: 'glitch' } ).click();
		await expect( page.locator( '#turns' ) ).toHaveAttribute( 'data-made', 'glitch' );
		await drawn( page, 'turns' );
		await demo.getByRole( 'button', { name: 'fan' } ).click();
		await drawn( page, 'laid' );
		expect( said ).toEqual( [] );
	} );

	test( 'the canvas is drawn by who is chosen', async ( { page } ) => {
		test.slow();
		await page.goto( '/docs/canvas/' );
		await page.waitForFunction( () => window.sliders?.drawn );
		const state = page.locator( '#drawn + p' );
		await expect( state ).toContainText(
			process.env.LAYER === 'gpu' ? 'drawn by WebGPU' : 'drawn by WebGL',
			{ timeout: 15000 }
		);
		await page.getByRole( 'button', { name: 'WebGL 2' } ).click();
		await expect( state ).toContainText( 'drawn by WebGL ', { timeout: 15000 } );
		await page.getByRole( 'button', { name: 'The page' } ).click();
		await expect( state ).toContainText( 'drawn by the page' );
		await expect( page.locator( '#drawn .ss-canvas' ) ).toHaveCount( 0 );
	} );

	test( 'a slider of attributes is made by auto.js', async ( { page } ) => {
		const said = errors( page );
		await page.goto( '/docs/html/' );
		const slider = page.locator( '#written .ss' );
		await expect( slider ).toHaveClass( /ss-on/ );
		const first = slider.locator( '.ss-slide' ).first();
		const { x } = await first.boundingBox();
		await slider.getByRole( 'button', { name: 'Next slide' } ).click();
		// The slides have moved by one.
		await expect
			.poll( async () => Math.round( x - ( await first.boundingBox() ).x ) )
			.toBeGreaterThan( 100 );
		await drawn( page, 'written' );
		expect( said ).toEqual( [] );
	} );

	test( 'pictures load again, a lightbox opens, a slider says what happens', async ( { page } ) => {
		test.slow();
		await page.goto( '/docs/loading/' );
		await page.waitForFunction( () => window.sliders?.loads );
		await page.getByRole( 'button', { name: 'Load them again' } ).click();
		await expect(
			page.getByTestId( 'loaded' ).locator( 'li' ).first()
		).toContainText( 'loading:done · 6 of 6', { timeout: 15000 } );

		await page.goto( '/docs/lightbox/' );
		await page.waitForFunction( () => window.sliders?.opens );
		await page.locator( '#opens .ss-slide' ).first().click();
		await expect( page.locator( '.ss-lightbox' ) ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( page.locator( '.ss-lightbox' ) ).toBeHidden();

		await page.goto( '/docs/options/' );
		await page.waitForFunction( () => window.sliders?.remote );
		await page.getByRole( 'button', { name: 'next()' } ).click();
		await expect( page.getByTestId( 'events' ) ).toContainText( 'change 1' );
	} );
} );

test( 'the sizes of the README are the ones that were measured', () => {
	const readme = readFileSync( new URL( '../../README.md', import.meta.url ), 'utf8' );
	const { parts, dist } = read( 'sizes.json' );
	for ( const [ row, bytes ] of [
		[ 'Core', parts.core ],
		[
			'`shaderslide/full`: the core with all its options',
			parts[ 'full: the slider with all its options' ],
		],
		[ '`canvas()`, which chooses the layer', parts[ 'canvas: what chooses the layer' ] ],
		[ 'Canvas layer of WebGPU', parts[ 'canvas layer of WebGPU, no effects' ] ],
		[ 'Canvas layer of WebGL 2', parts[ 'canvas layer, no effects' ] ],
		[ 'Lightbox', parts.lightbox ],
	] ) {
		expect( readme ).toContain( `| ${ row } | ${ kb( bytes ) } KB |` );
	}
	expect( readme ).toContain(
		`\`auto.js\` is one file of ${ kb( dist[ 'auto.js' ] ) } KB`
	);
	expect( readme ).toContain( `It is ${ kb( parts.core ) } KB.` );
} );

test.describe( 'on a phone', () => {
	test.use( { viewport: { width: 390, height: 800 } } );

	for ( const address of [ '/', '/examples/', '/docs/', '/docs/options/', '/docs/effects/' ] ) {
		test( `${ address } is as wide as the screen`, async ( { page } ) => {
			await page.goto( address );
			await expect( page.getByRole( 'heading', { level: 1 } ) ).toBeVisible();
			expect(
				await page.evaluate( () => document.documentElement.scrollWidth )
			).toBe( 390 );
		} );
	}
} );
