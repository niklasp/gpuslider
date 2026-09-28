import { test } from '@playwright/test';
import * as transitions from '../src/gl/transitions/index.js';
import { open, settled, painted, difference, draws, expect } from './helpers.js';

const shot = ( page ) => page.locator( '#slider .ss-track' ).screenshot();

/**
 * Collects what the page logs as errors: a shader that does not compile
 * says so there.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @return {string[]} Filled while the page runs.
 */
function errors( page ) {
	const logged = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' ) {
			logged.push( message.text() );
		}
	} );
	page.on( 'pageerror', ( error ) => logged.push( error.message ) );
	return logged;
}

/**
 * Holds the slider at a position, as a pointer would.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number}                          pos  Position, px.
 */
async function hold( page, pos ) {
	await page.evaluate( ( to ) => {
		const { motion } = window.slider;
		motion.dragging = true;
		motion.pos = to;
		window.slider.wake();
	}, pos );
	await page.waitForTimeout( 300 );
}

test.describe( 'transitions', () => {
	let plain;
	let half;

	test.beforeAll( async ( { browser } ) => {
		const page = await browser.newPage();
		await open( page, { n: 3, o: { mode: 'stack' } } );
		plain = await shot( page );
		await hold( page, 400 );
		half = await shot( page );
		await page.close();
	} );

	for ( const name of Object.keys( transitions ) ) {
		test( name, async ( { page } ) => {
			const logged = errors( page );
			await open( page, {
				n: 3,
				o: { mode: 'stack' },
				layers: 'gl',
				effects: name,
			} );
			expect( logged ).toEqual( [] );
			test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
			await painted( page );

			// At rest it is the slide, nothing else.
			const rest = await difference( page, plain, await shot( page ) );
			expect( rest.mean ).toBeLessThan( 2 );

			// Half way it is something, and not what a fade is, except for
			// what is close to one.
			await hold( page, 400 );
			const middle = await shot( page );
			const moved = await difference( page, plain, middle );
			expect( moved.mean ).toBeGreaterThan( 5 );
			expect( await page.locator( '.ss-canvas' ).count() ).toBe( 1 );
			await test.info().attach( name, {
				body: middle,
				contentType: 'image/png',
			} );
			const faded = await difference( page, half, middle );
			expect( faded.mean ).toBeGreaterThan( 1 );
		} );
	}
} );

test.describe( 'effects', () => {
	const REST = [
		'stretch',
		'split',
		'magnify',
		'spotlight',
		'bend:{"amount":0}',
		'stretch;split;magnify;spotlight',
	];
	for ( const effects of REST ) {
		test( `${ effects }: at rest the slides are as the page draws them`, async ( { page } ) => {
			const logged = errors( page );
			const setup = {
				n: 5,
				css: '.ss { --ss-per-view: 2; --ss-gap: 10px; }',
			};
			await open( page, setup );
			const plain = await shot( page );
			await open( page, { ...setup, layers: 'gl', effects } );
			expect( logged ).toEqual( [] );
			test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
			await painted( page );
			const { mean } = await difference( page, plain, await shot( page ) );
			expect( mean ).toBeLessThan( 2 );
		} );
	}

	test( 'stretch and split follow the speed and let go', async ( { page } ) => {
		await open( page, { n: 5, layers: 'gl', effects: 'stretch;split' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		const speeds = await page.evaluate(
			() =>
				new Promise( ( done ) => {
					const seen = [];
					window.slider.on( 'frame', ( view ) =>
						seen.push( view.velocity )
					);
					window.slider.on( 'settle', () =>
						setTimeout( () => done( seen ), 600 )
					);
					window.slider.next();
				} )
		);
		// Views per second: up, and down to nothing.
		expect( Math.max( ...speeds ) ).toBeGreaterThan( 1 );
		expect( speeds[ speeds.length - 1 ] ).toBe( 0 );
		await settled( page );
	} );

	test( 'moving, stretch draws something else than the page would', async ( { page } ) => {
		await open( page, { n: 5 } );
		await page.evaluate( () => {
			window.slider.track.style.transform = 'translate3d(-400px,0,0)';
		} );
		const plain = await shot( page );
		await open( page, { n: 5, layers: 'gl', effects: 'stretch' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		// Held at the same place, but with the speed of a move.
		await page.evaluate( () => {
			const { motion } = window.slider;
			motion.dragging = true;
			motion.pos = 400;
			window.slider.on( 'frame', () => {
				motion.smooth = -3 * 800;
			} );
			window.slider.wake();
		} );
		await page.waitForTimeout( 300 );
		const { mean } = await difference( page, plain, await shot( page ) );
		expect( mean ).toBeGreaterThan( 3 );
	} );

	test( 'the pointer moves the lens and leaves', async ( { page } ) => {
		await open( page, { n: 3, layers: 'gl', effects: 'magnify' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		const rest = await shot( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 300, box.y + 150 );
		await page.mouse.move( box.x + 400, box.y + 150 );
		await settled( page );
		const over = await shot( page );
		expect( ( await difference( page, rest, over ) ).mean ).toBeGreaterThan( 0.2 );
		await page.mouse.move( box.x + 400, box.y + 600 );
		await settled( page );
		const left = await shot( page );
		expect( ( await difference( page, rest, left ) ).mean ).toBeLessThan( 0.5 );
		// And then nothing is drawn any more.
		const before = await page.evaluate( () => window.frames_ );
		await page.waitForTimeout( 300 );
		expect( await page.evaluate( () => window.frames_ ) ).toBe( before );
	} );

	test( 'bend moves the mesh', async ( { page } ) => {
		const setup = { n: 6, css: '.ss { --ss-per-view: 3; --ss-gap: 10px; }' };
		await open( page, setup );
		const plain = await shot( page );
		await open( page, { ...setup, layers: 'gl', effects: 'bend' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		const { mean } = await difference( page, plain, await shot( page ) );
		expect( mean ).toBeGreaterThan( 3 );
	} );

	test( 'an effect of your own, as in the README', async ( { page } ) => {
		const logged = errors( page );
		await open( page, { n: 3 } );
		const plain = await shot( page );
		await page.evaluate( () => {
			const wobble = ( { amount = 0.02 } = {} ) => ( {
				params: { amount },
				animated: true,
				uv: `
				uv.x += sin( uv.y * 20.0 + uTime * 3.0 ) * amount;
				return uv;`,
			} );
			window.slider.destroy();
			window.slider = window.lib.createSlider(
				document.getElementById( 'slider' ),
				{
					layers: [
						window.lib.gl( {
							effects: [ wobble( { amount: 0.05 } ) ],
							preserve: true,
						} ),
					],
				}
			);
		} );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await page.waitForFunction( () =>
			document.querySelector( '.ss-media.ss-drawn' )
		);
		const { mean } = await difference( page, plain, await shot( page ) );
		expect( mean ).toBeGreaterThan( 1 );
		// It moves by itself: frames go on.
		const before = await page.evaluate( () => window.frames_ );
		await page.waitForTimeout( 300 );
		expect( await page.evaluate( () => window.frames_ ) ).toBeGreaterThan(
			before + 5
		);
		expect( logged ).toEqual( [] );
	} );
} );
