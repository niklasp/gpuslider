import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { open, settled, painted, drag, index, difference, draws, expect, GPU, unable, lose } from './helpers.js';

const shot = ( page ) => page.locator( '#slider .gs-track' ).screenshot();

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
			const media = root.querySelector( '.gs-media' );
			return {
				first: root.firstElementChild.className,
				opacity: getComputedStyle( media ).opacity,
				alt: media.alt,
			};
		} );
		expect( state ).toEqual( {
			first: 'gs-canvas',
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
				css: '.gs { --gs-per-view: 2.5; --gs-gap: 10px; } .gs-slide { border-radius: 30px; overflow: hidden; }',
			},
			() => page.evaluate( () => window.slider.to( 5, { instant: true } ) )
		);
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'corners of the shape the page gives them', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.gs { --gs-per-view: 2; --gs-gap: 10px; } .gs-slide { border-radius: 90px; corner-shape: squircle; overflow: hidden; } .gs-slide:nth-child(2) { border-radius: 60px; corner-shape: superellipse(3); }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'object-fit: contain and object-position', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.gs { --gs-per-view: 2; } .gs-media { object-fit: contain; object-position: 20% 80%; } .gs-slide:nth-child(2) .gs-media { object-fit: cover; object-position: 10px 100%; }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'the focus point, for all slides and for one', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.gs { --gs-per-view: 2; --gs-focus: 0% 100%; } .gs-slide:nth-child(2) { --gs-focus: 100% 30%; }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
		// And it is not the middle that is drawn.
		const focus = await page.locator( '#slider .gs-track' ).screenshot();
		await open( page, { n: 4, plugins: 'gl', css: '.gs { --gs-per-view: 2; }' } );
		await painted( page );
		const middle = await page.locator( '#slider .gs-track' ).screenshot();
		expect( ( await difference( page, focus, middle ) ).mean ).toBeGreaterThan( 3 );
	} );

	test( 'media smaller than its slide', async ( { page } ) => {
		const { mean, far } = await compare( page, {
			n: 4,
			css: '.gs { --gs-per-view: 2; } .gs-slide { padding: 20px 30px 40px 50px; box-sizing: border-box; }',
		} );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'right to left', async ( { page } ) => {
		const { mean, far } = await compare(
			page,
			{ n: 5, dir: 'rtl', css: '.gs { --gs-per-view: 2; --gs-gap: 10px; }' },
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
	test( 'a browser that cannot: the page draws, nothing is logged', async ( { page } ) => {
		const logged = [];
		page.on( 'console', ( message ) => {
			if ( [ 'error', 'warning' ].includes( message.type() ) ) {
				logged.push( message.text() );
			}
		} );
		page.on( 'pageerror', ( error ) => logged.push( error.message ) );
		await unable( page );
		await open( page, { n: 4, plugins: 'gl' } );
		await page.waitForTimeout( 300 );
		expect(
			await page.evaluate( () => window.slider.plugins.gl.canvas )
		).toBe( null );
		expect( await page.locator( '.gs-canvas' ).count() ).toBe( 0 );
		expect( await page.locator( '.gs-drawn' ).count() ).toBe( 0 );
		await drag( page, -500, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		expect( logged ).toEqual( [] );
	} );

	test( 'a lost context gives the media back, a new one takes it again', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await page.waitForFunction(
			() => document.querySelectorAll( '.gs-drawn' ).length > 0
		);
		await lose( page );
		await page.waitForFunction(
			() => document.querySelectorAll( '.gs-drawn' ).length === 0
		);
		expect( await page.locator( '.gs-canvas' ).count() ).toBe( 0 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		await page.waitForFunction(
			() => document.querySelectorAll( '.gs-drawn' ).length > 0,
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
		expect( await page.locator( '.gs-drawn' ).count() ).toBe( 0 );
		await page.evaluate( () => window.scrollTo( 0, 0 ) );
		await page.waitForFunction( () => !! window.slider.plugins.gl.canvas );
	} );

	test( 'more sliders than contexts: the rest is drawn by the page', async ( { page } ) => {
		test.skip( GPU, 'WebGPU has one device for all sliders of a page.' );
		await open( page, { n: 3, plugins: 'gl', css: '.gs { margin-block: 4px; } .gs-slide { height: 30px; } .tall, button, [data-gs-dots] { display: none; }' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		const drawing = await page.evaluate( async () => {
			const first = document.getElementById( 'slider' );
			const sliders = [ window.slider ];
			for ( let i = 0; i < 15; i++ ) {
				const copy = first.cloneNode( true );
				copy.removeAttribute( 'id' );
				copy.querySelector( 'canvas' )?.remove();
				copy.querySelectorAll( '.gs-drawn' ).forEach( ( el ) =>
					el.classList.remove( 'gs-drawn' )
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

test.describe( 'one device for all', () => {
	test( 'twenty sliders, all drawn by the canvas, with one device', async ( { page } ) => {
		test.skip( ! GPU, 'WebGL has a context for every slider.' );
		await open( page, { n: 3, plugins: 'gl', css: '.gs { margin-block: 4px; } .gs-slide { height: 30px; } .tall, button, [data-gs-dots] { display: none; }' } );
		test.skip( ! ( await draws( page ) ), 'No WebGPU in this browser.' );
		const drawing = await page.evaluate( async () => {
			const first = document.getElementById( 'slider' );
			const sliders = [ window.slider ];
			for ( let i = 0; i < 19; i++ ) {
				const copy = first.cloneNode( true );
				copy.removeAttribute( 'id' );
				copy.querySelector( 'canvas' )?.remove();
				copy.querySelectorAll( '.gs-drawn' ).forEach( ( el ) =>
					el.classList.remove( 'gs-drawn' )
				);
				document.body.append( copy );
				sliders.push(
					window.lib.createSlider( copy, {
						plugins: [ window.lib.gl( { eager: true } ) ],
					} )
				);
			}
			await new Promise( ( done ) => setTimeout( done, 800 ) );
			return [
				sliders.filter( ( slider ) => slider.plugins.gl.canvas ).length,
				document.querySelectorAll( '.gs-drawn' ).length,
				window.devices.length,
			];
		} );
		expect( drawing ).toEqual( [ 20, 60, 1 ] );
	} );
} );

test.describe( 'the canvas waits for the first sign of use', () => {
	const canvases = ( page ) => page.locator( '#slider .gs-canvas' ).count();

	test( 'a slider that rests has none', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl', lazy: 1 } );
		await page.waitForTimeout( 500 );
		expect( await canvases( page ) ).toBe( 0 );
		expect( await page.locator( '.gs-drawn' ).count() ).toBe( 0 );
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

	test( 'a pointer that was there before the slider, and moves', async ( { page } ) => {
		await open( page, { n: 4, plugins: 'gl', lazy: 1 } );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 300, box.y + 100 );
		await expect.poll( () => canvases( page ) ).toBe( 1 );
		// The slider again, under the pointer that does not leave.
		await page.evaluate( () => {
			const { createSlider, gl } = window.lib;
			window.slider.destroy();
			window.slider = createSlider( document.getElementById( 'slider' ), {
				plugins: [ gl( { preserve: true } ) ],
			} );
		} );
		await page.waitForTimeout( 300 );
		expect( await canvases( page ) ).toBe( 0 );
		await page.mouse.move( box.x + 320, box.y + 110 );
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

test.describe( 'an effect of one\'s own', () => {
	test( 'what is written into a parameter is drawn in the next frame', async ( { page } ) => {
		await open( page, { plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No canvas in this browser.' );
		await page.evaluate( () => {
			const { createSlider, gl } = window.lib;
			window.slider.destroy();
			window.tint = [ 1, 0, 0 ];
			window.slider = createSlider( document.getElementById( 'slider' ), {
				plugins: [
					gl( {
						effects: [
							{
								params: { tint: window.tint, more: [ 1 ] },
								color: 'return vec4( tint * more * color.a, color.a );',
							},
						],
						preserve: true,
						eager: true,
					} ),
				],
			} );
		} );
		expect( await draws( page ) ).toBe( true );
		await painted( page );
		const colour = () =>
			page.evaluate( () => [
				...window.pixels( window.slider.plugins.gl, 200, 100, 1, 1 ),
			] );
		await expect.poll( colour ).toEqual( [ 255, 0, 0, 255 ] );
		await page.evaluate( () => {
			window.tint[ 0 ] = 0;
			window.tint[ 2 ] = 1;
			window.slider.wake();
		} );
		await expect.poll( colour ).toEqual( [ 0, 0, 255, 255 ] );
	} );
} );
