/**
 * Which slide is seen at a point: what `hit()` says is what the canvas
 * draws.
 */
import { test } from '@playwright/test';
import { open, settled, painted, unable, expect } from './helpers.js';

const LAID = [ 'coverflow', 'pile', 'fan', 'dome:{"amount":1.5}', 'bend' ];

const setup = ( effects, more = {} ) => ( {
	n: 7,
	o: { loop: true, align: 'center', ...more },
	css: '.gs { --gs-per-view: 3; padding-block: 40px; } .gs-y { height: 600px; padding: 0 40px; }',
	plugins: 'gl,hit',
	effects,
} );

/**
 * Points all over the slider: whether the canvas has drawn there, and
 * which slide is seen there.
 */
const compare = ( page ) =>
	page.evaluate( () => {
		const { slider } = window;
		const layer = slider.plugins.gl;
		const { canvas } = layer;
		const pixels = window.pixels( layer );
		const box = canvas.getBoundingClientRect();
		const ratio = canvas.width / box.width;
		const found = { points: 0, wrong: [], slides: new Set() };
		for ( let y = 6; y < box.height; y += 12 ) {
			for ( let x = 6; x < box.width; x += 12 ) {
				const at = slider.plugins.hit.at( box.left + x, box.top + y );
				const alpha =
					pixels[
						( Math.floor( y * ratio ) * canvas.width +
							Math.floor( x * ratio ) ) *
							4 +
							3
					];
				found.points++;
				found.slides.add( at );
				if ( at >= 0 !== alpha > 127 ) {
					found.wrong.push( [ x, y, at, alpha ] );
				}
			}
		}
		return { ...found, slides: [ ...found.slides ].sort() };
	} );

test.describe( 'what is seen at a point', () => {
	for ( const effects of LAID ) {
		test( `${ effects }: where a slide is said to be, the canvas has drawn`, async ( { page } ) => {
			await open( page, setup( effects ) );
			await painted( page );
			for ( const move of [ 0, 2 ] ) {
				await page.evaluate(
					( to ) => window.slider.to( to, { instant: true } ),
					move
				);
				await painted( page );
				const { points, wrong, slides } = await compare( page );
				expect( points ).toBeGreaterThan( 1000 );
				// The edges of what is drawn are soft, and a point may be on one.
				expect( wrong.length / points, JSON.stringify( wrong.slice( 0, 5 ) ) ).toBeLessThan(
					0.02
				);
				// Several slides are seen, and somewhere none is.
				expect( slides.length ).toBeGreaterThan( 2 );
			}
		} );
	}

	test( 'downwards too', async ( { page } ) => {
		await open( page, setup( 'coverflow', { axis: 'y' } ) );
		await painted( page );
		const { points, wrong, slides } = await compare( page );
		expect( wrong.length / points, JSON.stringify( wrong.slice( 0, 5 ) ) ).toBeLessThan( 0.02 );
		expect( slides.length ).toBeGreaterThan( 2 );
	} );

	test( 'a click on a cover at the edge is a click on that cover, not on the slide whose place it is', async ( { page } ) => {
		await open( page, setup( 'coverflow' ) );
		await painted( page );
		await page.evaluate( () => {
			window.clicked = [];
			window.slider.on( 'click', ( { index } ) => window.clicked.push( index ) );
		} );
		// 800 px, three slides: the one before the active one has the
		// left third of the page. What is seen at its left edge is the one
		// before that.
		const at = [ 105, 240 ];
		const under = await page.evaluate(
			( [ x, y ] ) =>
				Number( document.elementFromPoint( x, y ).closest( '.gs-slide' ).dataset.i ),
			at
		);
		expect( under ).toBe( 6 );
		await page.mouse.click( ...at );
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [ 5 ] );
		// What is there to be used is where the page has it.
		await page.evaluate( () => {
			window.clicked = [];
			document
				.querySelectorAll( '.gs-content a' )
				.forEach( ( link ) =>
					link.addEventListener( 'click', ( event ) => event.preventDefault() )
				);
		} );
		await page.locator( '.gs-slide[data-i="6"] a' ).click();
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [ 6 ] );
	} );

	test( 'while the page draws, the page says where a slide is', async ( { page } ) => {
		await unable( page );
		await open( page, setup( 'coverflow' ) );
		expect(
			await page.evaluate( () => [
				window.slider.plugins.hit.at( 105, 240 ) ?? null,
				window.slider.plugins.hit.where( 0 ),
			] )
		).toEqual( [ null, null ] );
		await page.evaluate( () => {
			window.clicked = [];
			window.slider.on( 'click', ( { index } ) => window.clicked.push( index ) );
		} );
		await page.mouse.click( 105, 240 );
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [ 6 ] );
	} );

	test( 'the lightbox lets the image grow out of where it is drawn', async ( { page } ) => {
		await open( page, {
			...setup( 'coverflow' ),
			plugins: 'gl,hit,lightbox',
			open: 3000,
		} );
		await painted( page );
		const drawn = await page.evaluate( () => window.slider.plugins.hit.where( 6 ) );
		const onPage = await page
			.locator( '.gs-slide[data-i="6"] img' )
			.boundingBox();
		// Turned away, it is narrower than its place.
		expect( drawn.width ).toBeLessThan( onPage.width - 20 );
		await page.mouse.click( drawn.left + drawn.width / 2, 240 );
		await expect( page.locator( '.gs-lightbox' ) ).toBeVisible();
		expect(
			await page.evaluate( () => window.slider.plugins.lightbox.slider.index )
		).toBe( 6 );
		await settled( page );
	} );
} );
