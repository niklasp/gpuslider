import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { open, settled, painted, drag, index, difference, draws, expect } from './helpers.js';

const shot = ( page ) => page.locator( '#slider .ss-track' ).screenshot();

/**
 * Opens the same slider without and with the canvas layer and compares
 * what is on the screen.
 *
 * @param {import('@playwright/test').Page} page  Page.
 * @param {Object}                          setup Setup of the test page.
 * @param {Function}                        [act] What to do before the
 *                                                screenshot.
 * @return {Promise<Object>} Difference.
 */
async function compare( page, setup, act = () => {} ) {
	await open( page, setup );
	await act();
	await settled( page );
	const plain = await shot( page );
	await open( page, { ...setup, plugins: 'gl' } );
	test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
	await act();
	await settled( page );
	await painted( page );
	const drawn = await shot( page );
	const result = await difference( page, plain, drawn );
	if ( result.mean >= 2 ) {
		// What differed, next to the other results of the test.
		writeFileSync( test.info().outputPath( 'page.png' ), plain );
		writeFileSync( test.info().outputPath( 'canvas.png' ), drawn );
	}
	return result;
}

test.describe( 'the canvas draws what the page would', () => {
	test( 'one per view', async ( { page } ) => {
		const { mean, far } = await compare( page, { n: 4 } );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
		// The media of the page is transparent, the canvas is below the
		// slides.
		const state = await page.evaluate( () => {
			const root = window.slider.root;
			const media = root.querySelector( '.ss-media' );
			return {
				first: root.firstElementChild.className,
				opacity: getComputedStyle( media ).opacity,
				alt: media.alt,
			};
		} );
		expect( state ).toEqual( {
			first: 'ss-canvas',
			opacity: '0',
			alt: 'Slide 1',
		} );
	} );

	test( 'several per view, gaps, rounded corners, looped round', async ( { page } ) => {
		const { mean, far } = await compare(
			page,
			{
				n: 6,
				o: { loop: true },
				css: '.ss { --ss-per-view: 2.5; --ss-gap: 10px; } .ss-slide { border-radius: 30px; overflow: hidden; }',
			},
			() => page.evaluate( () => window.slider.to( 5, { instant: true } ) )
		);
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'object-fit: contain and object-position', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.ss { --ss-per-view: 2; } .ss-media { object-fit: contain; object-position: 20% 80%; } .ss-slide:nth-child(2) .ss-media { object-fit: cover; object-position: 10px 100%; }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'the focus point, for all slides and for one', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.ss { --ss-per-view: 2; --ss-focus: 0% 100%; } .ss-slide:nth-child(2) { --ss-focus: 100% 30%; }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
		// And it is not the middle that is drawn.
		const focus = await page.locator( '#slider .ss-track' ).screenshot();
		await open( page, { n: 4, plugins: 'gl', css: '.ss { --ss-per-view: 2; }' } );
		await painted( page );
		const middle = await page.locator( '#slider .ss-track' ).screenshot();
		expect( ( await difference( page, focus, middle ) ).mean ).toBeGreaterThan( 3 );
	} );

	test( 'media smaller than its slide', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.ss { --ss-per-view: 2; } .ss-slide { padding: 20px 30px 40px 50px; box-sizing: border-box; }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'right to left', async ( { page } ) => {
		const { mean, far } = await compare(
			page,
			{ n: 5, dir: 'rtl', css: '.ss { --ss-per-view: 2; --ss-gap: 10px; }' },
			() => page.evaluate( () => window.slider.to( 1, { instant: true } ) )
		);
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'stack, at rest', async ( { page } ) => {
		const { mean, far } = await compare(
			page,
			{ n: 3, o: { mode: 'stack' } },
			() => page.evaluate( () => window.slider.to( 1, { instant: true } ) )
		);
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );
} );

test.describe( 'the canvas follows the slider', () => {
	test( 'while it is dragged', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 600, box.y + 150 );
		await page.mouse.down();
		await page.mouse.move( box.x + 590, box.y + 150 );
		await page.mouse.move( box.x + 290, box.y + 150 );
		await page.waitForTimeout( 100 );
		// Held 300 px to the left: the canvas shows the first slide up to
		// 500 px and the second one from there.
		const held = await shot( page );
		await page.mouse.up();
		await settled( page );
		await open( page, { n: 4 } );
		await page.evaluate( () => {
			window.slider.track.style.transform = 'translate3d(-300px,0,0)';
		} );
		const { mean, far } = await difference( page, held, await shot( page ) );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'at rest nothing is drawn', async ( { page } ) => {
		await open( page, { n: 4, o: { loop: true }, plugins: 'gl' } );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		await page.waitForTimeout( 200 );
		await settled( page );
		const before = await page.evaluate( () => window.frames_ );
		await page.waitForTimeout( 400 );
		expect( await page.evaluate( () => window.frames_ ) ).toBe( before );
	} );
} );

test.describe( 'without the canvas', () => {
	test( 'no WebGL 2: the page draws, nothing is logged', async ( { page } ) => {
		const logged = [];
		page.on( 'console', ( message ) => {
			if ( [ 'error', 'warning' ].includes( message.type() ) ) {
				logged.push( message.text() );
			}
		} );
		page.on( 'pageerror', ( error ) => logged.push( error.message ) );
		await page.addInitScript( () => {
			const get = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function ( type, ...rest ) {
				return type === 'webgl2' ? null : get.call( this, type, ...rest );
			};
		} );
		await open( page, { n: 4, plugins: 'gl' } );
		await page.waitForTimeout( 300 );
		expect(
			await page.evaluate( () => window.slider.plugins.gl.canvas )
		).toBe( null );
		expect( await page.locator( '.ss-canvas' ).count() ).toBe( 0 );
		expect( await page.locator( '.ss-drawn' ).count() ).toBe( 0 );
		await drag( page, -500, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		expect( logged ).toEqual( [] );
	} );

	test( 'a lost context gives the media back, a new one takes it again', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await page.waitForFunction(
			() => document.querySelectorAll( '.ss-drawn' ).length > 0
		);
		await page.evaluate( () => {
			window.slider.plugins.gl.canvas
				.getContext( 'webgl2' )
				.getExtension( 'WEBGL_lose_context' )
				.loseContext();
		} );
		await page.waitForFunction(
			() => document.querySelectorAll( '.ss-drawn' ).length === 0
		);
		expect( await page.locator( '.ss-canvas' ).count() ).toBe( 0 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		await page.waitForFunction(
			() => document.querySelectorAll( '.ss-drawn' ).length > 0,
			null,
			{ timeout: 5000 }
		);
		expect( await draws( page ) ).toBe( true );
	} );

	test( 'off screen the context is given back', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await page.evaluate( () => window.scrollTo( 0, 1500 ) );
		await page.waitForFunction( () => ! window.slider.plugins.gl.canvas );
		expect( await page.locator( '.ss-drawn' ).count() ).toBe( 0 );
		await page.evaluate( () => window.scrollTo( 0, 0 ) );
		await page.waitForFunction( () => !! window.slider.plugins.gl.canvas );
	} );

	test( 'more sliders than contexts: the rest is drawn by the page', async ( { page } ) => {
		await open( page, { n: 3, plugins: 'gl', css: '.ss { margin-block: 4px; } .ss-slide { height: 30px; } .tall, button, [data-ss-dots] { display: none; }' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		const drawing = await page.evaluate( async () => {
			const first = document.getElementById( 'slider' );
			const sliders = [ window.slider ];
			for ( let i = 0; i < 15; i++ ) {
				const copy = first.cloneNode( true );
				copy.removeAttribute( 'id' );
				copy.querySelector( 'canvas' )?.remove();
				copy.querySelectorAll( '.ss-drawn' ).forEach( ( el ) =>
					el.classList.remove( 'ss-drawn' )
				);
				document.body.append( copy );
				sliders.push(
					window.lib.createSlider( copy, {
						plugins: [ window.lib.gl( { eager: true } ) ],
					} )
				);
			}
			await new Promise( ( done ) => setTimeout( done, 500 ) );
			window.all = sliders;
			return sliders.filter( ( slider ) => slider.plugins.gl.canvas ).length;
		} );
		expect( drawing ).toBe( 12 );
		// One goes. A slider that found no context takes it when it is used.
		const after = await page.evaluate( async () => {
			window.all[ 0 ].destroy();
			const without = window.all.find(
				( slider, i ) => i && ! slider.plugins.gl.canvas
			);
			without.next();
			await new Promise( ( done ) => setTimeout( done, 500 ) );
			return [
				!! without.plugins.gl.canvas,
				window.all.filter( ( slider ) => slider.plugins.gl.canvas ).length,
			];
		} );
		expect( after ).toEqual( [ true, 12 ] );
	} );
} );

test.describe( 'the canvas waits for the first sign of use', () => {
	const canvases = ( page ) => page.locator( '#slider .ss-canvas' ).count();

	test( 'a slider that rests has none', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl', lazy: 1 } );
		await page.waitForTimeout( 500 );
		expect( await canvases( page ) ).toBe( 0 );
		expect( await page.locator( '.ss-drawn' ).count() ).toBe( 0 );
		// And the page has asked for no frame since.
		const frames = await page.evaluate( () => window.frames_ );
		await page.waitForTimeout( 300 );
		expect( await page.evaluate( () => window.frames_ ) ).toBe( frames );
	} );

	test( 'a pointer that comes', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl', lazy: 1 } );
		await page.locator( '#slider' ).hover();
		await expect.poll( () => canvases( page ) ).toBe( 1 );
		await painted( page );
	} );

	test( 'the focus', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl', lazy: 1 } );
		await page.locator( '#slider' ).focus();
		await expect.poll( () => canvases( page ) ).toBe( 1 );
	} );

	test( 'a move', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl', lazy: 1, effects: 'stretch' } );
		await page.evaluate( () => window.slider.next() );
		await expect.poll( () => canvases( page ) ).toBe( 1 );
		await settled( page );
		await painted( page );
		expect( await page.evaluate( () => window.slider.index ) ).toBe( 1 );
	} );

	test( 'what moves by itself has its canvas before it moves', async ( { page } ) => {
		await open( page, {
			n: 4,
			plugins: 'gl',
			lazy: 1,
			o: { autoplay: 60000 },
		} );
		await expect.poll( () => canvases( page ) ).toBe( 1 );
		expect( await page.evaluate( () => window.slider.index ) ).toBe( 0 );
	} );
} );
