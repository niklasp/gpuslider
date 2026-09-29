import { test } from '@playwright/test';
import { open, settled, painted, drag, leftOf, index, draws, expect } from './helpers.js';

const height = ( page ) =>
	page.evaluate( () =>
		Math.round( window.slider.track.getBoundingClientRect().height )
	);

test.describe( 'auto height', () => {
	// The images are 16:9, 4:3 and 3:4: at 800 px wide 450, 600 and 1067 px
	// high.
	const setup = { n: 3, heights: 1, o: { autoHeight: true } };

	test( 'the slider is as high as its slide', async ( { page } ) => {
		await open( page, setup );
		expect( await height( page ) ).toBe( 450 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await height( page ) ).toBe( 600 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await height( page ) ).toBe( 1067 );
	} );

	test( 'the height follows the move', async ( { page } ) => {
		await open( page, setup );
		await page.evaluate( () => {
			const { motion } = window.slider;
			motion.dragging = true;
			motion.pos = 400;
			window.slider.wake();
		} );
		await page.waitForTimeout( 100 );
		expect( await height( page ) ).toBe( 525 );
	} );

	test( 'several per view: as high as the tallest in view', async ( { page } ) => {
		await open( page, {
			...setup,
			n: 4,
			css: '.ss { --ss-per-view: 2; }',
		} );
		// 400 px wide: 225, 300, 533, 225.
		expect( await height( page ) ).toBe( 300 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await height( page ) ).toBe( 533 );
	} );

	test( 'moving does not measure', async ( { page } ) => {
		await open( page, setup );
		await page.evaluate( () => {
			window.reads = 0;
			const read = Element.prototype.getBoundingClientRect;
			Element.prototype.getBoundingClientRect = function () {
				window.reads++;
				return read.call( this );
			};
			window.slider.next();
		} );
		await settled( page );
		expect( await page.evaluate( () => window.reads ) ).toBe( 0 );
		expect( await height( page ) ).toBe( 600 );
	} );

	test( 'the canvas draws slides of different heights', async ( { page } ) => {
		await open( page, { ...setup, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		await page.evaluate( () => window.slider.to( 2 ) );
		await settled( page );
		await painted( page );
		const canvas = await page.evaluate( () => {
			const { canvas } = window.slider.plugins.gl;
			return {
				css: Math.round( canvas.getBoundingClientRect().height ),
				root: window.slider.root.clientHeight,
			};
		} );
		// As high as the tallest slide needs, the whole time.
		expect( canvas.css ).toBe( canvas.root );
		await page.evaluate( () => window.slider.to( 0 ) );
		await settled( page );
		const after = await page.evaluate( () =>
			Math.round(
				window.slider.plugins.gl.canvas.getBoundingClientRect().height
			)
		);
		expect( after ).toBe( canvas.css );
	} );
} );

test.describe( 'autoplay', () => {
	test( 'goes on, and round at the end', async ( { page } ) => {
		await open( page, { n: 3, o: { autoplay: 300, duration: 200 } } );
		await page.mouse.move( 5, 650 );
		await expect.poll( () => index( page ) ).toBe( 1 );
		await expect.poll( () => index( page ) ).toBe( 2 );
		await expect.poll( () => index( page ) ).toBe( 0 );
	} );

	test( 'waits while the pointer is over the slider', async ( { page } ) => {
		await open( page, { n: 3, o: { autoplay: 300, duration: 200 } } );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		const at = await index( page );
		await page.waitForTimeout( 900 );
		expect( await index( page ) ).toBe( at );
		await page.mouse.move( 5, 650 );
		await expect.poll( () => index( page ) ).not.toBe( at );
	} );

	test( 'the pause button stops it', async ( { page } ) => {
		await open( page, { n: 3, o: { autoplay: 300, duration: 200 } } );
		await page.mouse.move( 5, 650 );
		const button = page.locator( '[data-ss-pause]' );
		await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
		await button.click();
		await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );
		await page.mouse.move( 5, 650 );
		await settled( page );
		const at = await index( page );
		await page.waitForTimeout( 900 );
		expect( await index( page ) ).toBe( at );
	} );

	test( 'waits off screen', async ( { page } ) => {
		await open( page, { n: 3, o: { autoplay: 300, duration: 200 } } );
		await page.mouse.move( 5, 650 );
		await page.evaluate( () => window.scrollTo( 0, 1500 ) );
		await page.waitForTimeout( 400 );
		await settled( page );
		const at = await index( page );
		await page.waitForTimeout( 900 );
		expect( await index( page ) ).toBe( at );
	} );
} );

test.describe( 'wheel', () => {
	test( 'scrolling sideways moves the slider and it comes to rest on a slide', async ( { page } ) => {
		await open( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		for ( let i = 0; i < 10; i++ ) {
			await page.mouse.wheel( 50, 0 );
			await page.waitForTimeout( 16 );
		}
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		expect( await leftOf( page, 1 ) ).toBe( 0 );
	} );

	test( 'scrolling down is left to the page', async ( { page } ) => {
		await open( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		await page.mouse.wheel( 0, 300 );
		await expect
			.poll( () => page.evaluate( () => window.scrollY ) )
			.toBeGreaterThan( 100 );
		expect( await index( page ) ).toBe( 0 );
	} );
} );

test.describe( 'free', () => {
	test( 'rests where it comes to rest', async ( { page } ) => {
		await open( page, {
			n: 8,
			o: { free: true },
			css: '.ss { --ss-per-view: 3; }',
		} );
		await drag( page, -300, { pause: 150 } );
		await settled( page );
		// As far as the pointer went after the drag was recognised.
		const left = await leftOf( page, 0 );
		expect( left ).toBeLessThan( -250 );
		expect( left ).toBeGreaterThan( -275 );
	} );

	test( 'glides on with the speed it was let go with, not past the end', async ( { page } ) => {
		await open( page, {
			n: 4,
			o: { free: true },
			css: '.ss { --ss-per-view: 3; }',
		} );
		await drag( page, -200, { steps: 4 } );
		await settled( page );
		// A third of a view wide slides, four of them: the end is 267 px
		// away.
		expect( Math.abs( ( await leftOf( page, 0 ) ) + 266.67 ) ).toBeLessThan( 1 );
	} );
} );

test.describe( 'video', () => {
	const playing = ( page ) =>
		page.evaluate( () =>
			[ ...document.querySelectorAll( 'video' ) ].map(
				( video ) => ! video.paused
			)
		);

	test( 'plays while its slide is in the view', async ( { page } ) => {
		await open( page, { n: 4, video: '1,3' } );
		await expect.poll( () => playing( page ) ).toEqual( [ false, false ] );
		await page.evaluate( () => window.slider.next() );
		await expect.poll( () => playing( page ) ).toEqual( [ true, false ] );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		await expect.poll( () => playing( page ) ).toEqual( [ false, false ] );
		await page.evaluate( () => window.slider.next() );
		await expect.poll( () => playing( page ) ).toEqual( [ false, true ] );
	} );

	test( 'waits off screen', async ( { page } ) => {
		await open( page, { n: 4, video: '0' } );
		await expect.poll( () => playing( page ) ).toEqual( [ true ] );
		await page.evaluate( () => window.scrollTo( 0, 1500 ) );
		await expect.poll( () => playing( page ) ).toEqual( [ false ] );
		await page.evaluate( () => window.scrollTo( 0, 0 ) );
		await expect.poll( () => playing( page ) ).toEqual( [ true ] );
	} );

	test( 'the canvas draws its frames', async ( { page } ) => {
		await open( page, { n: 4, video: '0', plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await expect
			.poll( () =>
				page.evaluate( () =>
					document.querySelector( 'video' ).classList.contains( 'ss-drawn' )
				)
			)
			.toBe( true );
		const read = () =>
			page.evaluate( () =>
				// Of the whole picture, a pixel here and there.
				[ ...window.pixels( window.slider.plugins.gl ) ].filter(
					( value, i ) => i % 4 < 3 && ! ( ( i >> 2 ) % 97 )
				)
			);
		const one = await read();
		expect( Math.max( ...one ) ).toBeGreaterThan( 0 );
		await page.waitForTimeout( 500 );
		const two = await read();
		expect( two ).not.toEqual( one );
		// Out of view: the video waits and nothing is drawn.
		await page.evaluate( () => window.slider.to( 2 ) );
		await settled( page );
		await page.waitForTimeout( 200 );
		const before = await page.evaluate( () => window.frames_ );
		await page.waitForTimeout( 400 );
		expect( await page.evaluate( () => window.frames_ ) ).toBe( before );
	} );
} );
