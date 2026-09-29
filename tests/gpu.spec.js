/**
 * WebGPU draws what WebGL draws: every effect and every transition, held
 * at the same place, once with each.
 *
 * Runs with LAYER=gpu, where the browser has both.
 */
import { test } from '@playwright/test';
import * as effects from '../src/gl/effects/index.js';
import * as transitions from '../src/gl/transitions/index.js';
import { open, painted, difference, draws, expect, GPU } from './helpers.js';

const shot = ( page ) => page.locator( '#slider' ).screenshot();

/**
 * The slider with a layer, held as a pointer would hold it, and told a
 * speed: what effects do with speed is seen while nothing moves.
 *
 * @param {import('@playwright/test').Page} page  Page.
 * @param {Object}                          setup What `open()` takes.
 * @param {number}                          pos   Position, px.
 * @return {Promise<Buffer|null>} The picture; null without the layer.
 */
async function held( page, setup, pos ) {
	await open( page, { plugins: 'gl', ...setup } );
	if ( ! ( await draws( page ) ) ) {
		return null;
	}
	await painted( page );
	const box = await page.locator( '#slider' ).boundingBox();
	await page.mouse.move( box.x + 300, box.y + 120 );
	await page.evaluate( ( to ) => {
		const { motion, plugins } = window.slider;
		plugins.gl.change = ( i, quad ) => {
			quad.speed = 1.5;
		};
		motion.dragging = true;
		motion.pos = to;
		window.slider.wake();
	}, pos );
	// Until every slide that came into view is drawn, and the pointer of
	// the shader is where the pointer is.
	await page.waitForTimeout( 1200 );
	return shot( page );
}

/**
 * @param {import('@playwright/test').Page} page  Page.
 * @param {Object}                          setup What `open()` takes.
 * @param {number}                          pos   Position, px.
 * @return {Promise<Object|null>} How far the pictures of the two layers
 *                                are apart, and how far the one of WebGPU
 *                                is from the page.
 */
async function both( page, setup, pos ) {
	const logged = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' ) {
			logged.push( message.text() );
		}
	} );
	const { plugins, effects: none, ...bare } = setup;
	await open( page, bare );
	await page.evaluate( ( to ) => {
		window.slider.motion.dragging = true;
		window.slider.motion.pos = to;
		window.slider.wake();
	}, pos );
	await page.waitForTimeout( 300 );
	const plain = await shot( page );
	const old = await held( page, { ...setup, layer: 'gl' }, pos );
	const now = await held( page, { ...setup, layer: 'gpu' }, pos );
	expect( logged ).toEqual( [] );
	if ( ! old || ! now ) {
		return null;
	}
	return {
		apart: ( await difference( page, old, now ) ).mean,
		effect: ( await difference( page, plain, now ) ).mean,
	};
}

test.describe( 'WebGPU draws what WebGL draws', () => {
	test.skip( ! GPU, 'With LAYER=gpu.' );

	const row = { n: 6, css: '.gs { --gs-per-view: 2.5; --gs-gap: 10px; }' };

	test( 'a row without effects', async ( { page } ) => {
		const seen = await both( page, row, 130 );
		test.skip( ! seen, 'No WebGPU in this browser.' );
		expect( seen.apart ).toBeLessThan( 1 );
		expect( seen.effect ).toBeLessThan( 2 );
	} );

	for ( const name of Object.keys( effects ) ) {
		// Rings that run are other rings a moment later.
		const still = name === 'waves' ? 'waves:{"speed":0}' : name;
		test( `effect: ${ name }`, async ( { page } ) => {
			const seen = await both(
				page,
				{
					...row,
					o: { align: 'center', contain: false, start: 2 },
					effects: still,
				},
				130
			);
			test.skip( ! seen, 'No WebGPU in this browser.' );
			expect( seen.apart ).toBeLessThan( 1.5 );
			// And it is the effect that is drawn, not the row.
			expect( seen.effect ).toBeGreaterThan( 0.3 );
		} );
	}

	test( 'all effects of the speed and the pointer at once, downwards', async ( { page } ) => {
		const seen = await both(
			page,
			{
				n: 5,
				o: { axis: 'y' },
				css: '.gs { height: 400px; --gs-per-view: 1.5; --gs-gap: 10px; } .gs-slide { height: auto; }',
				effects: 'stretch;split;magnify;spotlight;glass;parallax;cells',
			},
			90
		);
		test.skip( ! seen, 'No WebGPU in this browser.' );
		expect( seen.apart ).toBeLessThan( 1.5 );
		expect( seen.effect ).toBeGreaterThan( 0.3 );
	} );

	for ( const name of Object.keys( transitions ) ) {
		test( `transition: ${ name }`, async ( { page } ) => {
			const seen = await both(
				page,
				{ n: 3, o: { mode: 'stack' }, effects: name },
				400
			);
			test.skip( ! seen, 'No WebGPU in this browser.' );
			expect( seen.apart ).toBeLessThan( 1.5 );
			expect( seen.effect ).toBeGreaterThan( 0.3 );
		} );
	}
} );
