import { test } from '@playwright/test';
import { open, settled, drag, index, difference, expect, unable } from './helpers.js';

const setup = {
	n: 5,
	plugins: 'gl,lightbox',
	css: '.gs { --gs-per-view: 2; --gs-gap: 10px; } .gs-slide { border-radius: 12px; overflow: hidden; }',
};

const box = ( page ) =>
	page.evaluate( () => !! window.slider.plugins.lightbox );

/** Waits until the lightbox is as far open as it goes. */
const opened = ( page, progress = 1 ) =>
	page.waitForFunction(
		( to ) => {
			const layer = window.slider.plugins.lightbox;
			return (
				layer.progress === to &&
				( to === 0 ? ! layer.slider : layer.slider.resting )
			);
		},
		progress
	);

/** Whether the canvas of the slider draws the lightbox. */
const draws = ( page ) =>
	page
		.waitForFunction(
			() => !! document.querySelector( 'dialog > canvas' ),
			null,
			{ timeout: 2000 }
		)
		.then(
			() => true,
			() => false
		);

test.describe( 'lightbox', () => {
	test( 'a click on a slide opens it, Escape closes it', async ( { page } ) => {
		await open( page, setup );
		const dialog = page.locator( 'dialog.gs-lightbox' );
		await page.locator( '.gs-slide[data-i="1"] .gs-content' ).click( {
			position: { x: 200, y: 200 },
		} );
		await expect( dialog ).toBeVisible();
		await opened( page );
		// The page behind it cannot be reached, the focus is in the dialog.
		expect(
			await page.evaluate( () => ( {
				modal: document.querySelector( 'dialog' ).matches( ':modal' ),
				focus: !! document.activeElement.closest( 'dialog' ),
				at: window.slider.plugins.lightbox.slider.index,
				slides: window.slider.plugins.lightbox.slider.slides.length,
			} ) )
		).toEqual( { modal: true, focus: true, at: 1, slides: 5 } );
		await page.keyboard.press( 'Escape' );
		await opened( page, 0 );
		await expect( dialog ).toBeHidden();
		expect( await box( page ) ).toBeTruthy();
	} );

	test( 'opened by a click, the focus comes back without its ring', async ( { page } ) => {
		await open( page, { ...setup, plugins: 'gl,lightbox,keyboard' } );
		await page.locator( '#slider .gs-slide' ).nth( 1 ).click();
		await opened( page );
		await page.keyboard.press( 'Escape' );
		await opened( page, 0 );
		expect(
			await page.evaluate( () => [
				document.activeElement === window.slider.root,
				document.activeElement.matches( ':focus-visible' ),
			] )
		).toEqual( [ true, false ] );
	} );

	test( 'the end of a drag and a click on a link do not open it', async ( { page } ) => {
		await open( page, setup );
		await drag( page, -300, { pause: 150 } );
		await settled( page );
		await page.locator( '.gs-slide[data-i="1"] a' ).click();
		await page.waitForTimeout( 100 );
		expect( await page.locator( 'dialog[open]' ).count() ).toBe( 0 );
		expect( page.url() ).toContain( '#followed' );
	} );

	test( 'the image grows out of its slide and goes back into it', async ( { page } ) => {
		await open( page, { ...setup, open: 4000 } );
		// Where the image of the second slide is.
		const thumb = await page.evaluate( () => {
			const r = window.slider.slides[ 1 ]
				.querySelector( '.gs-media' )
				.getBoundingClientRect();
			return { x: r.left, y: r.top, w: r.width, h: r.height };
		} );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 1 ) );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await page.waitForFunction(
			() => window.slider.plugins.lightbox.progress > 0
		);

		// The canvas of the slider draws the way: where it draws the
		// image, on the screen.
		await page.evaluate( () => {
			const layer = window.slider.plugins.gl;
			let hook = layer.change;
			Object.defineProperty( layer, 'change', {
				get: () =>
					hook &&
					( ( i, quad ) => {
						hook( i, quad );
						if ( i === 1 ) {
							const r = window.slider.root.getBoundingClientRect();
							window.grown = {
								x: quad.x + r.left,
								y: quad.y + r.top,
								w: quad.w,
								h: quad.h,
							};
						}
					} ),
				set: ( to ) => ( hook = to ),
			} );
		} );
		// A frame that the canvas has drawn since it was asked.
		const drawn = async () => {
			await page.evaluate( () => ( window.grown = null ) );
			await page.waitForFunction( () => window.grown );
			return page.evaluate( () => ( {
				t: window.slider.plugins.lightbox.progress,
				...window.grown,
			} ) );
		};

		const early = await drawn();
		expect( early.t ).toBeLessThan( 0.5 );
		// Between the slide and the screen, and growing.
		expect( early.w ).toBeGreaterThan( thumb.w - 4 );
		expect( early.w ).toBeLessThan( 900 );
		await page.waitForTimeout( 300 );
		const later = await drawn();
		expect( later.w ).toBeGreaterThan( early.w );
		expect( later.h ).toBeGreaterThan( early.h );
		// It starts where the slide is: its middle is closer to it than
		// to the middle of the screen.
		expect( Math.abs( early.x + early.w / 2 - 500 ) ).toBeGreaterThan(
			Math.abs( later.x + later.w / 2 - 500 )
		);

		// Escape half way: it turns round and goes back into the slide.
		await page.keyboard.press( 'Escape' );
		await page.waitForFunction(
			( was ) => window.slider.plugins.lightbox.progress < was - 0.1,
			later.t
		);
		const back = await drawn();
		expect( back.w ).toBeLessThan( later.w );
	} );

	test( 'open, the canvas shows the whole image as the page would', async ( { page } ) => {
		await open( page, { ...setup, open: 150 } );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 2 ) );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await opened( page );
		await page.waitForFunction( () =>
			window.slider.plugins.lightbox.slider.slides[ 2 ].querySelector(
				'.gs-drawn'
			)
		);
		await opened( page );
		// The image, whole in the screen: around it the canvas draws the
		// slider as the page behind the lightbox is.
		const clip = await page.evaluate( () => {
			const media =
				window.slider.plugins.lightbox.slider.slides[ 2 ].firstChild;
			const r = media.getBoundingClientRect();
			const k = Math.min(
				r.width / media.naturalWidth,
				r.height / media.naturalHeight
			);
			const w = media.naturalWidth * k;
			const h = media.naturalHeight * k;
			return {
				x: Math.ceil( r.left + ( r.width - w ) / 2 ) + 1,
				y: Math.ceil( r.top + ( r.height - h ) / 2 ) + 1,
				width: Math.floor( w ) - 2,
				height: Math.floor( h ) - 2,
			};
		} );
		const shot = () => page.screenshot( { clip } );
		const canvas = await shot();
		// The same without the canvas: the images of the lightbox, which
		// are there and not seen.
		await page.evaluate( () => {
			const dialog = document.querySelector( 'dialog' );
			dialog.querySelector( ':scope > canvas' ).style.visibility = 'hidden';
			dialog.style.setProperty( '--gs-shown', 1 );
			dialog
				.querySelectorAll( '.gs-drawn' )
				.forEach( ( el ) => el.classList.remove( 'gs-drawn' ) );
		} );
		const { mean, far } = await difference( page, canvas, await shot() );
		expect( mean ).toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'the lightbox is a slider: arrows, keys and drags', async ( { page } ) => {
		await open( page, { ...setup, open: 150 } );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 0 ) );
		await opened( page );
		const at = () =>
			page.evaluate( () => window.slider.plugins.lightbox.slider.index );
		await page.keyboard.press( 'ArrowRight' );
		await expect.poll( at ).toBe( 1 );
		await page.locator( 'dialog [data-gs-next]' ).click();
		await expect.poll( at ).toBe( 2 );
		await opened( page );
		await page.mouse.move( 700, 350 );
		await page.mouse.down();
		await page.mouse.move( 680, 350 );
		await page.mouse.move( 100, 350, { steps: 6 } );
		await page.waitForTimeout( 150 );
		await page.mouse.up();
		await expect.poll( at ).toBe( 3 );
		await opened( page );
		// It goes back to the slide it was left at, and the slider behind
		// has that slide in view.
		await page.locator( 'dialog [data-gs-close]' ).click();
		await opened( page, 0 );
		await settled( page );
		expect( await index( page ) ).toBe( 3 );
	} );

	test( 'a click next to the image closes it', async ( { page } ) => {
		await open( page, { ...setup, open: 150 } );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 0 ) );
		await opened( page );
		// The image is 16:9 in a view of 1000 by 700: below it is room.
		await page.mouse.click( 500, 350 );
		await page.waitForTimeout( 300 );
		expect( await page.locator( 'dialog[open]' ).count() ).toBe( 1 );
		await page.mouse.click( 500, 680 );
		await opened( page, 0 );
		expect( await page.locator( 'dialog[open]' ).count() ).toBe( 0 );
	} );

	test( 'in a browser that cannot draw the canvas it fades', async ( { page } ) => {
		await unable( page );
		await open( page, { ...setup, open: 600 } );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 1 ) );
		await page.waitForFunction(
			() => window.slider.plugins.lightbox.progress > 0.05
		);
		const half = await page.evaluate( () =>
			Number(
				getComputedStyle(
					document.querySelector( 'dialog .gs-slide:nth-child(2) .gs-media' )
				).opacity
			)
		);
		expect( half ).toBeGreaterThan( 0 );
		expect( half ).toBeLessThan( 1 );
		await opened( page );
		await page.keyboard.press( 'Escape' );
		await opened( page, 0 );
		expect( await page.locator( 'dialog[open]' ).count() ).toBe( 0 );
	} );

	test( 'reduced motion: it is there at once', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await open( page, { ...setup, open: 3000 } );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 1 ) );
		await page.waitForFunction(
			() => window.slider.plugins.lightbox.progress === 1,
			null,
			{ timeout: 1500 }
		);
	} );

	test( 'destroy takes the dialog away', async ( { page } ) => {
		await open( page, { ...setup, open: 150 } );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 1 ) );
		await opened( page );
		await page.evaluate( () => window.slider.destroy() );
		expect( await page.locator( 'dialog' ).count() ).toBe( 0 );
	} );
} );
