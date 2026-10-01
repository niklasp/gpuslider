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
	[ '/docs/extending/', 'Extending' ],
	[ '/docs/community/', 'Community plugins' ],
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
				return slider.locator( '.gs-drawn' ).count();
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
		await page
			.getByRole( 'navigation', { name: 'Pages', exact: true } )
			.getByRole( 'link', { name: 'Docs' } )
			.click();
		await expect( page ).toHaveURL( /\/docs\/$/ );
		await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Get started' );
	} );

	test( 'its numbers are the ones that were measured', async ( { page } ) => {
		const { parts } = read( 'sizes.json' );
		const [ chromium ] = read( 'bench.json' ).browsers;
		const numbers = page.getByTestId( 'numbers' ).locator( '> li' );
		await expect( numbers ).toHaveCount( 6 );
		await expect( numbers.first() ).toContainText( `${ kb( parts.core ) }KB` );
		const second = chromium.until.find(
			( one ) => one.layer === 'gpu' && one.effects === 'stretch,waves'
		).second;
		await expect( numbers.nth( 2 ) ).toContainText( `${ Math.round( second ) }ms` );
		// The scores of Lighthouse, for a phone and, when chosen, a desktop.
		const { pages } = read( 'lighthouse.json' );
		const scores = page.getByTestId( 'scores' ).getByRole( 'listitem' );
		await expect( scores ).toHaveCount( 5 );
		await expect( scores.first() ).toContainText(
			`Performance: ${ pages[ '/' ].mobile.performance } of 100`
		);
		await page.getByRole( 'button', { name: 'Desktop' } ).click();
		await expect( scores.first() ).toContainText(
			`Performance: ${ pages[ '/' ].desktop.performance } of 100`
		);

		// Pointed at, the core tells what every part weighs.
		await numbers.first().hover();
		await expect( numbers.first().locator( '.card li' ).first() ).toBeVisible();
		await expect( numbers.first().locator( '.card li' ).first() ).toContainText(
			`${ kb( parts.core ) } KB`
		);
	} );

	test( 'every feature leads to a page of the docs that is there', async ( { page } ) => {
		const features = page.getByTestId( 'features' ).getByRole( 'listitem' );
		await expect( features ).toHaveCount( 8 );
		const all = await links( page, '[data-testid="features"]' );
		expect( all.length ).toBeGreaterThan( 5 );
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
		const choice = page.getByRole( 'group', { name: 'Effect' } );
		await expect( choice.getByRole( 'button', { name: 'liquid' } ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		await drawn( page, 'first' );
		const before = await page.evaluateHandle( () => window.sliders.first );
		await choice.getByRole( 'button', { name: 'burn' } ).click();
		await expect( choice.getByRole( 'button', { name: 'burn' } ) ).toHaveAttribute(
			'aria-current',
			'true'
		);
		// Picked in the shader that has them all: the slider stays the one it is.
		expect(
			await page.evaluate( ( was ) => was === window.sliders.first, before )
		).toBe( true );
		expect(
			await page.evaluate( () => Object.keys( window.sliders.first.plugins ) )
		).toEqual( expect.arrayContaining( [ 'stack', 'autoplay' ] ) );
		await drawn( page, 'first' );
		expect( said ).toEqual( [] );
	} );

	test( 'the photos are the pictures, and the colour fields can take their place', async ( { page } ) => {
		const said = errors( page );
		const pictures = page.getByRole( 'group', { name: 'Pictures' } );
		const first = page.locator( '#first .gs-slide:first-child .gs-media' );
		await expect( first ).toHaveAttribute( 'src', '/media/p3-960.avif' );
		// Every field has a photo of its own, and there is no film.
		await expect(
			page.locator( '#first .gs-slide:nth-child(7) .gs-media' )
		).toHaveAttribute( 'src', '/media/p8-960.avif' );
		await expect( page.locator( '#first video' ) ).toHaveCount( 0 );
		await pictures.getByRole( 'button', { name: 'Colour fields' } ).click();
		await expect( first ).toHaveAttribute( 'src', '/media/1-960.avif' );
		// The slider is made again, with the canvas.
		await page.waitForFunction(
			() => window.sliders.first.slides[ 0 ].querySelector( 'img' ).src.includes( '/1-' )
		);
		await drawn( page, 'first' );
		await page.reload();
		await expect( first ).toHaveAttribute( 'src', '/media/1-960.avif' );
		await expect(
			pictures.getByRole( 'button', { name: 'Colour fields' } )
		).toHaveAttribute( 'aria-pressed', 'true' );
		await pictures.getByRole( 'button', { name: 'Photos' } ).click();
		await expect( first ).toHaveAttribute( 'src', '/media/p3-960.avif' );
		expect( said ).toEqual( [] );
	} );

	test( 'the ways to use it are the ones of the README', async ( { page } ) => {
		const code = page.getByRole( 'tabpanel' );
		await expect( code ).toContainText( `import { createSlider } from 'gpuslider';` );
		await page.getByRole( 'tab', { name: 'React' } ).click();
		await expect( code ).toContainText( '<Slider' );
		await page.getByRole( 'tab', { name: 'No script of your own' } ).click();
		await expect( code ).toContainText( 'data-gs-canvas="stretch waves"' );
	} );
} );

test.describe( 'the examples', () => {
	test( 'there are seven, with a picture each, and they lead to their pages', async ( { page } ) => {
		await page.goto( '/examples/' );
		const all = page.getByTestId( 'examples' ).locator( '> li' );
		await expect( all ).toHaveCount( 12 );
		await expect( all.getByRole( 'heading' ) ).toHaveText( [
			'A wall of images',
			'A reel',
			'Tape',
			'Loom',
			'Wave',
			'Depth',
			'Journal',
			'Orbit',
			'Fold',
			'Resolve',
			'Reveal',
			'Echo',
		] );
		for ( const name of [ 'wall', 'reel', 'tape', 'loom', 'wave', 'depth', 'journal', 'orbit', 'fold', 'resolve', 'reveal', 'echo' ] ) {
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
		await expect( all ).toHaveCount( 6 );
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
			await expect( page ).toHaveTitle( `${ title } · Docs · gpu slider` );
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
		const readme = readFileSync( new URL( '../../DOCS.md', import.meta.url ), 'utf8' );
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
		await expect( page.locator( '#drawn .gs-canvas' ) ).toHaveCount( 0 );
	} );

	test( 'a slider of attributes is made by auto.js', async ( { page } ) => {
		const said = errors( page );
		await page.goto( '/docs/html/' );
		const slider = page.locator( '#written .gs' );
		await expect( slider ).toHaveClass( /gs-on/ );
		const first = slider.locator( '.gs-slide' ).first();
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
		await page.locator( '#opens .gs-slide' ).first().click();
		await expect( page.locator( '.gs-lightbox' ) ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( page.locator( '.gs-lightbox' ) ).toBeHidden();

		await page.goto( '/docs/options/' );
		await page.waitForFunction( () => window.sliders?.remote );
		await page.getByRole( 'button', { name: 'next()' } ).click();
		await expect( page.getByTestId( 'events' ) ).toContainText( 'change 1' );
	} );
} );

test( 'the sizes of the README are the ones that were measured', () => {
	const readme = readFileSync( new URL( '../../DOCS.md', import.meta.url ), 'utf8' );
	const { parts, dist } = read( 'sizes.json' );
	for ( const [ row, bytes ] of [
		[ 'Core', parts.core ],
		[
			'`gpuslider/full`: the core with all its options',
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

test.describe( 'the components of React', () => {
	test( 'options are props, state moves the slider, and what is in it has it', async ( { page } ) => {
		await page.goto( '/docs/react/' );
		const slider = page.locator( '#react' );
		await expect( slider ).toHaveClass( /gs-on/ );
		await expect( slider.locator( '.gs-track > .gs-slide' ) ).toHaveCount( 6 );
		const said = page.getByTestId( 'react' ).locator( 'output' );
		const back = slider.getByRole( 'button', { name: 'Previous slide' } );
		const on = slider.getByRole( 'button', { name: 'Next slide' } );
		const first = () =>
			slider.locator( '.gs-slide' ).first().evaluate(
				( slide ) => slide.getBoundingClientRect().left - slide.parentElement.parentElement.getBoundingClientRect().left
			);

		// An arrow that has the slider by the context.
		await expect( back ).toBeDisabled();
		await on.click();
		await expect( said ).toHaveText( '2 of 6' );
		await expect( back ).toBeEnabled();
		await expect.poll( first ).toBeLessThan( -100 );

		// State of React moves it.
		await page.getByRole( 'button', { name: 'To 1', exact: true } ).click();
		await expect( said ).toHaveText( '1 of 6' );
		await expect.poll( first ).toBeGreaterThan( -1 );
		await expect( back ).toBeDisabled();

		// A prop changes the slider that exists: it is not made again.
		await page.evaluate( () => {
			window.kept = window.sliders.react;
		} );
		await page.getByRole( 'button', { name: 'loop', exact: true } ).click();
		await expect( back ).toBeEnabled();
		await back.click();
		await expect( said ).toHaveText( '6 of 6' );
		expect(
			await page.evaluate( () => [
				window.kept === window.sliders.react,
				window.kept.options.loop,
			] )
		).toEqual( [ true, true ] );
		await expect( slider ).toHaveClass( /gs-on/ );
	} );
} );

test.describe( 'the page for phones', () => {
	test.use( { viewport: { width: 412, height: 823 } } );

	test( 'says what the browser has, measures, and writes it down', async ( { page } ) => {
		test.slow();
		await page.goto( '/phone/' );
		await expect( page.getByTestId( 'has' ).getByRole( 'row' ) ).toHaveCount( 12 );
		await expect(
			page.getByTestId( 'has' ).getByRole( 'row', { name: 'WebGL 2' } )
		).toContainText( /^WebGL 2(yes|no)/ );
		for ( const id of [ 'row', 'turning', 'opening' ] ) {
			await expect( page.locator( `#${ id }` ) ).toHaveClass( /gs-on/ );
		}
		// As wide as the screen.
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth
			)
		).toBe( true );

		// What was tried is kept, and said.
		const tried = page.getByRole( 'group', { name: /A flick goes on/ } );
		await tried.getByRole( 'button', { name: 'yes' } ).click();
		const report = page.getByTestId( 'report' );
		await expect( report ).toHaveValue( /\[yes\] A flick goes on/ );
		await expect( report ).toHaveValue( /not measured/ );

		await page.getByRole( 'button', { name: 'Measure' } ).click();
		await expect( report ).toHaveValue( /Twelve sliders, WebGPU asked/, {
			timeout: 60000,
		} );
		const said = await report.inputValue();
		expect( said ).toMatch( /WebGL asked, (WebGL|the page) drew/ );
		expect( said ).toMatch( /\d+ frames, [\d.]+ ms apart in the middle/ );
		await expect( page.getByTestId( 'runs' ).getByRole( 'row' ) ).toHaveCount( 3 );
		await expect( page.getByRole( 'button', { name: 'Measure' } ) ).toBeEnabled();
		// Every slider that was made for it has ended.
		await expect( page.locator( '[data-measured].gs-on' ) ).toHaveCount( 0 );

		await page.reload();
		await expect(
			page
				.getByRole( 'group', { name: /A flick goes on/ } )
				.getByRole( 'button', { name: 'yes' } )
		).toHaveAttribute( 'aria-pressed', 'true' );
	} );
} );
