import { test } from '@playwright/test';
import { open, settled, painted, index, draws, difference, expect } from './helpers.js';

const shot = ( page ) => page.locator( '#slider' ).screenshot();

/** Top edge of a slide on the screen, relative to the slider. */
const topOf = ( page, i ) =>
	page.evaluate( ( n ) => {
		const root = document.getElementById( 'slider' ).getBoundingClientRect();
		const slide = window.slider.slides[ n ].getBoundingClientRect();
		return Math.round( slide.top - root.top ) || 0;
	}, i );

test.describe( 'downwards', () => {
	const setup = {
		n: 5,
		o: { axis: 'y' },
		css: '.gs { height: 300px; } .gs-slide { height: auto; } button, [data-gs-dots], nav { display: none; }',
	};

	test( 'the slides follow each other downwards, one per view', async ( { page } ) => {
		await open( page, setup );
		expect(
			await page.evaluate( () => {
				const { y, span, size, left, snaps } = window.slider.layout();
				return { y, span, size: size[ 0 ], second: left[ 1 ], snaps: snaps.length };
			} )
		).toEqual( { y: true, span: 300, size: 300, second: 300, snaps: 5 } );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await topOf( page, 1 ) ).toBe( 0 );
		expect( await topOf( page, 0 ) ).toBe( -300 );
	} );

	test( 'several per view, with a gap', async ( { page } ) => {
		await open( page, {
			...setup,
			css: `${ setup.css } .gs { --gs-per-view: 2; --gs-gap: 20px; }`,
		} );
		expect(
			await page.evaluate( () => {
				const { size, left, gap } = window.slider.layout();
				return [ size[ 0 ], left[ 1 ], gap ];
			} )
		).toEqual( [ 140, 160, 20 ] );
	} );

	test( 'a drag down or up moves it, a drag to the side does not', async ( { page } ) => {
		await open( page, setup );
		const box = await page.locator( '#slider' ).boundingBox();
		const drag = async ( dx, dy ) => {
			await page.mouse.move( box.x + 400, box.y + 200 );
			await page.mouse.down();
			for ( let i = 1; i <= 8; i++ ) {
				await page.mouse.move(
					box.x + 400 + ( dx * i ) / 8,
					box.y + 200 + ( dy * i ) / 8
				);
				await page.waitForTimeout( 16 );
			}
			await page.waitForTimeout( 150 );
			await page.mouse.up();
			await settled( page );
		};
		await drag( 0, -180 );
		expect( await index( page ) ).toBe( 1 );
		await drag( -300, 10 );
		expect( await index( page ) ).toBe( 1 );
		await drag( 0, 180 );
		expect( await index( page ) ).toBe( 0 );
	} );

	test( 'it loops', async ( { page } ) => {
		await open( page, { ...setup, o: { axis: 'y', loop: true } } );
		await page.evaluate( () => window.slider.prev() );
		await settled( page );
		expect( await index( page ) ).toBe( 4 );
		expect( await topOf( page, 4 ) ).toBe( 0 );
	} );

	test( 'the arrows up and down, and the wheel', async ( { page } ) => {
		await open( page, setup );
		await page.locator( '#slider' ).focus();
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'ArrowDown' );
		expect( await index( page ) ).toBe( 2 );
		await page.keyboard.press( 'ArrowRight' );
		expect( await index( page ) ).toBe( 2 );
		await page.keyboard.press( 'ArrowUp' );
		expect( await index( page ) ).toBe( 1 );
		await settled( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		await page.mouse.wheel( 0, 200 );
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		expect( await page.evaluate( () => window.scrollY ) ).toBe( 0 );
	} );

	test( 'at its end the wheel scrolls the page', async ( { page } ) => {
		await open( page, { ...setup, o: { axis: 'y', start: 4 } } );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		await page.mouse.wheel( 0, 200 );
		await expect
			.poll( () => page.evaluate( () => window.scrollY ) )
			.toBeGreaterThan( 100 );
		expect( await index( page ) ).toBe( 4 );
	} );

	test( 'the canvas draws what the page draws, at rest and on the way', async ( { page } ) => {
		const css = `${ setup.css } .gs { --gs-per-view: 1.5; --gs-gap: 10px; }`;
		await open( page, { ...setup, css } );
		await page.evaluate( () => {
			window.slider.grab();
			window.slider.drag( 130 );
		} );
		await page.waitForTimeout( 200 );
		const plain = await shot( page );
		await open( page, { ...setup, css, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		await page.evaluate( () => {
			window.slider.grab();
			window.slider.drag( 130 );
		} );
		await page.waitForTimeout( 300 );
		await page.waitForFunction(
			() => document.querySelectorAll( '.gs-drawn' ).length >= 2
		);
		// Held, the slider does not rest, and nothing says when the canvas
		// has the pictures of the slides that came into view: it has them
		// soon.
		let far = 1;
		await expect
			.poll( async () => {
				const now = await difference( page, plain, await shot( page ) );
				far = now.far;
				return now.mean;
			} )
			.toBeLessThan( 2 );
		expect( far ).toBeLessThan( 0.01 );
	} );

	test( 'stretch bows along the way of the slides', async ( { page } ) => {
		await open( page, { ...setup, plugins: 'gl', effects: 'stretch' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		const rest = await shot( page );
		await page.evaluate( () => {
			const { motion } = window.slider;
			window.slider.on( 'frame', () => {
				motion.smooth = -3 * 300;
			} );
			window.slider.wake();
		} );
		await page.waitForTimeout( 300 );
		const moved = await shot( page );
		// In the middle the picture is pushed by 0.09 of the slide, 27 px:
		// down or up, not to a side.
		const fits = await page.evaluate(
			async ( [ a, b ] ) => {
				const read = async ( file ) => {
					const bitmap = await createImageBitmap(
						new Blob(
							[ Uint8Array.from( atob( file ), ( c ) => c.charCodeAt( 0 ) ) ],
							{ type: 'image/png' }
						)
					);
					const canvas = new OffscreenCanvas( bitmap.width, bitmap.height );
					const context = canvas.getContext( '2d' );
					context.drawImage( bitmap, 0, 0 );
					return context.getImageData( 0, 0, bitmap.width, bitmap.height );
				};
				const [ one, two ] = [ await read( a ), await read( b ) ];
				const scale = one.width / 800;
				const by = Math.round( 27 * scale );
				// How far the picture that moves is from the one at rest,
				// pushed by some pixels.
				const far = ( dx, dy ) => {
					let sum = 0;
					let n = 0;
					for ( let y = 0.4 * one.height; y < 0.6 * one.height; y += 2 ) {
						for ( let x = 0.45 * one.width; x < 0.55 * one.width; x += 2 ) {
							const at = 4 * ( Math.floor( y ) * one.width + Math.floor( x ) );
							const from =
								4 *
								( Math.floor( y + dy ) * one.width + Math.floor( x + dx ) );
							sum += Math.abs( two.data[ at ] - one.data[ from ] );
							n++;
						}
					}
					return sum / n;
				};
				return {
					still: far( 0, 0 ),
					along: Math.min( far( 0, by ), far( 0, -by ) ),
					across: Math.min( far( by, 0 ), far( -by, 0 ) ),
				};
			},
			[ rest.toString( 'base64' ), moved.toString( 'base64' ) ]
		);
		expect( fits.still ).toBeGreaterThan( 3 );
		expect( fits.along ).toBeLessThan( fits.still * 0.7 );
		expect( fits.along ).toBeLessThan( fits.across * 0.7 );
	} );
} );

test.describe( 'rows', () => {
	// Nothing of the script: a grid that flows in columns.
	const setup = {
		n: 9,
		css: `.gs-track { display: grid; grid-auto-flow: column; grid-template-rows: repeat( 2, 140px ); grid-auto-columns: calc( ( 100% - 2 * 10px ) / 3 ); gap: 10px; }
			.gs-slide { height: auto; }`,
	};

	test( 'two rows: a snap per column', async ( { page } ) => {
		await open( page, setup );
		expect(
			await page.evaluate( () => {
				const { left, snaps } = window.slider.layout();
				return {
					columns: [ ...new Set( left.map( Math.round ) ) ],
					snaps: snaps.map( Math.round ),
					count: window.slider.count(),
				};
			} )
		).toEqual( {
			columns: [ 0, 270, 540, 810, 1080 ],
			snaps: [ 0, 270, 540 ],
			count: 3,
		} );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect(
			await page.evaluate( () => window.slider.visible() )
		).toEqual( [ 2, 3, 4, 5, 6, 7 ] );
	} );

	test( 'the canvas draws both rows', async ( { page } ) => {
		await open( page, setup );
		const plain = await shot( page );
		await open( page, { ...setup, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		expect(
			await page.locator( '.gs-drawn' ).count()
		).toBeGreaterThanOrEqual( 6 );
		// Small slides: the browsers make images small in their own ways.
		const { mean } = await difference( page, plain, await shot( page ) );
		expect( mean ).toBeLessThan( 3 );
	} );
} );

test.describe( 'marquee', () => {
	const setup = {
		n: 6,
		core: 1,
		o: { loop: true, free: true },
		css: '.gs { --gs-per-view: 3; --gs-gap: 10px; }',
	};
	const pos = ( page ) => page.evaluate( () => window.slider.motion.pos );
	const run = ( page, options ) =>
		page.evaluate(
			( o ) => window.slider.use( window.lib.marquee( o ) ),
			options
		);

	test( 'runs evenly, and on after a drag', async ( { page } ) => {
		await open( page, setup );
		await run( page, { speed: 200 } );
		const from = await pos( page );
		await page.waitForTimeout( 1000 );
		const way = ( await pos( page ) ) - from;
		expect( way ).toBeGreaterThan( 120 );
		expect( way ).toBeLessThan( 320 );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 600, box.y + 150 );
		await page.mouse.down();
		await page.mouse.move( box.x + 500, box.y + 150, { steps: 5 } );
		expect( await page.evaluate( () => window.slider.motion.dragging ) ).toBe( true );
		await page.waitForTimeout( 100 );
		await page.mouse.up();
		const then = await pos( page );
		await page.waitForTimeout( 600 );
		expect( await pos( page ) ).toBeGreaterThan( then + 60 );
	} );

	test( 'slower under the pointer, faster with the page', async ( { page } ) => {
		await open( page, setup );
		await run( page, { speed: 200, hover: 0, scroll: 1 } );
		const way = async ( ms ) => {
			const from = await pos( page );
			await page.waitForTimeout( ms );
			return ( await pos( page ) ) - from;
		};
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		await page.waitForTimeout( 800 );
		expect( await way( 300 ) ).toBeLessThan( 5 );
		await page.mouse.move( box.x + 400, box.y + 600 );
		await page.waitForTimeout( 800 );
		expect( await way( 300 ) ).toBeGreaterThan( 40 );
		// The page is scrolled: further than by itself, and the effects of
		// the canvas are told of a speed.
		const fast = page.evaluate( async () => {
			let most = 0;
			const from = window.slider.motion.pos;
			const off = window.slider.on( 'frame', ( view ) => {
				most = Math.max( most, view.velocity );
			} );
			for ( let i = 0; i < 30; i++ ) {
				window.scrollBy( 0, i < 15 ? 20 : -20 );
				await new Promise( ( done ) => requestAnimationFrame( done ) );
			}
			off();
			return { most, way: window.slider.motion.pos - from };
		} );
		const { most, way: far } = await fast;
		expect( far ).toBeGreaterThan( 200 );
		expect( most ).toBeGreaterThan( 0.2 );
	} );

	test( 'the slides go round', async ( { page } ) => {
		await open( page, setup );
		await run( page, { speed: 3000 } );
		await page.waitForTimeout( 1200 );
		// More than a round of 1620 px, and every slide in view is drawn in
		// the view.
		expect( await pos( page ) ).toBeGreaterThan( 1700 );
		const lefts = await page.evaluate( () =>
			window.slider.visible().map( ( i ) => {
				const root = window.slider.root.getBoundingClientRect();
				const r = window.slider.slides[ i ].getBoundingClientRect();
				return r.right > root.left && r.left < root.right;
			} )
		);
		expect( lefts.length ).toBeGreaterThanOrEqual( 3 );
		expect( lefts.every( Boolean ) ).toBe( true );
	} );

	test( 'stands still when told to, off the screen, and for who asks for less motion', async ( { page } ) => {
		await open( page, setup );
		await run( page, { speed: 200 } );
		const stands = async () => {
			await page.waitForTimeout( 150 );
			const from = await pos( page );
			await page.waitForTimeout( 300 );
			return ( await pos( page ) ) === from;
		};
		expect( await stands() ).toBe( false );
		await page.evaluate( () => window.slider.plugins.marquee.pause() );
		expect( await stands() ).toBe( true );
		// And asks for no frames.
		await page.evaluate( () => {
			window.drawn = 0;
			window.slider.on( 'frame', () => window.drawn++ );
		} );
		await page.waitForTimeout( 200 );
		expect( await page.evaluate( () => window.drawn ) ).toBe( 0 );
		await page.evaluate( () => window.slider.plugins.marquee.play() );
		expect( await stands() ).toBe( false );
		expect( await page.evaluate( () => window.drawn ) ).toBeGreaterThan( 5 );
		await page.evaluate( () => window.scrollTo( 0, 1500 ) );
		expect( await stands() ).toBe( true );
		await page.evaluate( () => window.scrollTo( 0, 0 ) );
		expect( await stands() ).toBe( false );
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		expect( await stands() ).toBe( true );
		await page.emulateMedia( { reducedMotion: 'no-preference' } );
		expect( await stands() ).toBe( false );
	} );

	test( 'it gets its canvas without anybody coming', async ( { page } ) => {
		// Not by `open()`, which waits for a rest that a ticker has not.
		const query = new URLSearchParams( {
			n: '6',
			core: '1',
			o: JSON.stringify( setup.o ),
			css: setup.css,
			plugins: 'gl,marquee',
			lazy: '1',
			...( process.env.FROM ? { from: process.env.FROM } : {} ),
		} );
		await page.goto( `/tests/page.html?${ query }` );
		await page.waitForFunction( () => window.ready );
		// Asked of the browser: the slider has no canvas yet.
		test.skip(
			! ( await page.evaluate(
				() => !! document.createElement( 'canvas' ).getContext( 'webgl2' )
			) ),
			'No WebGL 2 in this browser.'
		);
		await expect( page.locator( '#slider canvas' ) ).toHaveCount( 1 );
		await expect
			.poll( () => page.locator( '#slider .gs-drawn' ).count() )
			.toBeGreaterThanOrEqual( 3 );
	} );

	test( 'a slider with ends stands still', async ( { page } ) => {
		await open( page, { ...setup, o: {} } );
		await run( page, { speed: 200 } );
		await page.waitForTimeout( 300 );
		expect( await pos( page ) ).toBe( 0 );
	} );
} );

test.describe( 'thumbnails', () => {
	const make = ( page ) =>
		page.evaluate( () => {
			const two = document.getElementById( 'slider' ).cloneNode( true );
			two.id = 'thumbs';
			two.querySelectorAll( 'button, [data-gs-dots], .gs-content' ).forEach(
				( el ) => el.remove()
			);
			two.style.cssText = '--gs-per-view: 4; --gs-gap: 8px; margin-top: 8px';
			two.querySelectorAll( '.gs-slide' ).forEach( ( slide ) => {
				slide.style.height = '80px';
				slide.removeAttribute( 'style' );
				slide.style.height = '80px';
				[ ...slide.attributes ].forEach(
					( { name } ) =>
						/^(role|aria-|inert)/.test( name ) &&
						slide.removeAttribute( name )
				);
			} );
			two.querySelector( '.gs-track' ).removeAttribute( 'style' );
			document.getElementById( 'slider' ).after( two );
			window.thumbs = window.lib.core.createSlider( two, {
				plugins: [ window.lib.thumbs( window.slider ) ],
			} );
		} );
	const active = ( page ) =>
		page.evaluate( () =>
			window.thumbs.slides.findIndex( ( slide ) =>
				slide.classList.contains( 'gs-active' )
			)
		);

	test( 'a click on one takes the slider to its slide', async ( { page } ) => {
		await open( page, { n: 8 } );
		await make( page );
		await expect.poll( () => active( page ) ).toBe( 0 );
		await page.locator( '#thumbs .gs-slide' ).nth( 2 ).click();
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		expect( await active( page ) ).toBe( 2 );
		await expect(
			page.locator( '#thumbs .gs-slide' ).nth( 2 )
		).toHaveAttribute( 'aria-current', 'true' );
		await expect( page.locator( '#thumbs [aria-current]' ) ).toHaveCount( 1 );
		// A resize leaves them what they are.
		await page.setViewportSize( { width: 900, height: 700 } );
		await page.waitForTimeout( 200 );
		await expect(
			page.locator( '#thumbs .gs-slide' ).nth( 2 )
		).toHaveAttribute( 'role', 'button' );
	} );

	test( 'the one of the slide that is shown comes into view', async ( { page } ) => {
		await open( page, { n: 8 } );
		await make( page );
		await page.evaluate( () => window.slider.to( 6 ) );
		await settled( page );
		await page.waitForFunction( () => window.thumbs.resting );
		expect( await active( page ) ).toBe( 6 );
		expect( await page.evaluate( () => window.thumbs.visible() ) ).toContain( 6 );
	} );

	test( 'they are buttons, for keys too', async ( { page } ) => {
		await open( page, { n: 8 } );
		await make( page );
		const third = page.locator( '#thumbs .gs-slide' ).nth( 3 );
		await expect( third ).toHaveAttribute( 'role', 'button' );
		await third.focus();
		await page.keyboard.press( 'Enter' );
		await settled( page );
		expect( await index( page ) ).toBe( 3 );
	} );
} );
