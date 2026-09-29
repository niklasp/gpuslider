import { test } from '@playwright/test';
import { open, settled, drag, leftOf, index, expect } from './helpers.js';

test.describe( 'moving', () => {
	test( 'a drag past half a slide goes to the next slide', async ( { page } ) => {
		await open( page );
		await drag( page, -500, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		expect( await leftOf( page, 1 ) ).toBe( 0 );
	} );

	test( 'a short slow drag goes back', async ( { page } ) => {
		await open( page );
		await drag( page, -120, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 0 );
		expect( await leftOf( page, 0 ) ).toBe( 0 );
	} );

	test( 'a short fast drag goes on', async ( { page } ) => {
		await open( page );
		// Pointer events made in the page: how fast the mouse of the test
		// is depends on how busy the machine is.
		await page.evaluate( async () => {
			const root = document.getElementById( 'slider' );
			const box = root.getBoundingClientRect();
			const fire = ( type, x, target = window ) =>
				target.dispatchEvent(
					new PointerEvent( type, {
						bubbles: true,
						isPrimary: true,
						pointerId: 1,
						clientX: box.left + x,
						clientY: box.top + 150,
					} )
				);
			fire( 'pointerdown', 400, root );
			for ( const x of [ 370, 340, 310, 280 ] ) {
				fire( 'pointermove', x );
				await new Promise( ( done ) => setTimeout( done, 4 ) );
			}
			fire( 'pointerup', 280 );
		} );
		await settled( page );
		// One slide on, however fast it was.
		expect( await index( page ) ).toBe( 1 );
	} );

	test( 'a fast drag over several slides goes as far as a view', async ( { page } ) => {
		await open( page, { n: 12, css: '.gs { --gs-per-view: 4; }' } );
		await page.evaluate( async () => {
			const root = document.getElementById( 'slider' );
			const box = root.getBoundingClientRect();
			const fire = ( type, x, target = window ) =>
				target.dispatchEvent(
					new PointerEvent( type, {
						bubbles: true,
						isPrimary: true,
						pointerId: 1,
						clientX: box.left + x,
						clientY: box.top + 150,
					} )
				);
			fire( 'pointerdown', 400, root );
			for ( const x of [ 370, 340, 310, 280 ] ) {
				fire( 'pointermove', x );
				await new Promise( ( done ) => setTimeout( done, 4 ) );
			}
			fire( 'pointerup', 280 );
		} );
		await settled( page );
		expect( await index( page ) ).toBe( 4 );
	} );

	test( 'the slider follows the pointer while it is held', async ( { page } ) => {
		await open( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 400, box.y + 150 );
		await page.mouse.down();
		await page.mouse.move( box.x + 380, box.y + 150 );
		await page.mouse.move( box.x + 200, box.y + 150 );
		await page.waitForTimeout( 50 );
		// From where the drag was recognised, not from where it began.
		const left = await leftOf( page, 0 );
		expect( left ).toBeLessThan( -170 );
		expect( left ).toBeGreaterThan( -205 );
		await page.mouse.up();
	} );

	test( 'past the ends the slider resists and comes back', async ( { page } ) => {
		await open( page );
		const box = await page.locator( '#slider' ).boundingBox();
		await page.mouse.move( box.x + 200, box.y + 150 );
		await page.mouse.down();
		await page.mouse.move( box.x + 220, box.y + 150 );
		await page.mouse.move( box.x + 500, box.y + 150 );
		await page.waitForTimeout( 50 );
		const left = await leftOf( page, 0 );
		expect( left ).toBeGreaterThan( 50 );
		expect( left ).toBeLessThan( 120 );
		await page.waitForTimeout( 150 );
		await page.mouse.up();
		await settled( page );
		expect( await leftOf( page, 0 ) ).toBe( 0 );
	} );

	test( 'a vertical drag is left to the page', async ( { page } ) => {
		await open( page );
		await drag( page, -60, { dy: 300 } );
		await settled( page );
		expect( await index( page ) ).toBe( 0 );
		expect( await leftOf( page, 0 ) ).toBe( 0 );
		expect(
			await page.evaluate( () => window.slider.motion.dragging )
		).toBe( false );
	} );

	test( 'a click follows the link, the end of a drag does not', async ( { page } ) => {
		await open( page, {
			css: '.gs-content a { display: block; height: 100%; }',
		} );
		await page.evaluate( () => {
			window.clicks = 0;
			window.slider.root.addEventListener( 'click', () => window.clicks++ );
		} );
		// Starts on the link of the first slide and ends on it: the slider
		// resists at its start and the pointer stays in the window.
		await drag( page, 60, { at: 30, pause: 150 } );
		await settled( page );
		expect( page.url() ).not.toContain( '#followed' );
		// Nor does it reach what listens for clicks on the slider, such as
		// a lightbox.
		expect( await page.evaluate( () => window.clicks ) ).toBe( 0 );
		await page.locator( '.gs-slide[data-i="0"] a' ).click();
		expect( page.url() ).toContain( '#followed' );
	} );
} );

test.describe( 'keyboard and controls', () => {
	test( 'arrow keys, Home and End', async ( { page } ) => {
		await open( page );
		await page.locator( '#slider' ).focus();
		await page.keyboard.press( 'ArrowRight' );
		await page.keyboard.press( 'ArrowRight' );
		expect( await index( page ) ).toBe( 2 );
		await page.keyboard.press( 'ArrowLeft' );
		expect( await index( page ) ).toBe( 1 );
		await page.keyboard.press( 'End' );
		expect( await index( page ) ).toBe( 4 );
		await page.keyboard.press( 'Home' );
		await settled( page );
		expect( await index( page ) ).toBe( 0 );
		expect( await leftOf( page, 0 ) ).toBe( 0 );
	} );

	test( 'arrows are disabled at the ends', async ( { page } ) => {
		await open( page, { n: 3 } );
		const prev = page.locator( '#slider > [data-gs-prev]' );
		const next = page.locator( '#slider > [data-gs-next]' );
		await expect( prev ).toBeDisabled();
		await next.click();
		await expect( prev ).toBeEnabled();
		await next.click();
		await expect( next ).toBeDisabled();
		expect( await index( page ) ).toBe( 2 );
	} );

	test( 'dots show and set the slide', async ( { page } ) => {
		await open( page, { n: 4 } );
		const dots = page.locator( '[data-gs-dot]' );
		await expect( dots ).toHaveCount( 4 );
		await expect( dots.nth( 0 ) ).toHaveAttribute( 'aria-current', 'true' );
		await dots.nth( 2 ).click();
		await settled( page );
		await expect( dots.nth( 2 ) ).toHaveAttribute( 'aria-current', 'true' );
		expect( await leftOf( page, 2 ) ).toBe( 0 );
	} );

	test( 'events: change when the move starts, settle when it ends', async ( { page } ) => {
		await open( page );
		await page.evaluate( () => {
			window.events.length = 0;
			window.slider.next();
		} );
		expect( await page.evaluate( () => window.events ) ).toEqual( [
			[ 'change', 1 ],
		] );
		await settled( page );
		expect( await page.evaluate( () => window.events ) ).toEqual( [
			[ 'change', 1 ],
			[ 'settle', 1 ],
		] );
	} );
} );

test.describe( 'layout', () => {
	test( 'several per view with a gap', async ( { page } ) => {
		await open( page, {
			n: 6,
			css: '.gs { --gs-per-view: 3; --gs-gap: 20px; }',
		} );
		// ( 800 - 2 * 20 ) / 3
		expect( await leftOf( page, 1 ) ).toBe( 273 );
		// The last three slides fill the view: four places to rest.
		expect( await page.evaluate( () => window.slider.count() ) ).toBe( 4 );
		await page.evaluate( () => window.slider.to( 3 ) );
		await settled( page );
		expect( await leftOf( page, 3 ) ).toBe( 0 );
		expect( await leftOf( page, 5 ) ).toBe( 547 );
	} );

	test( 'options set the custom properties', async ( { page } ) => {
		await open( page, { n: 6, o: { perView: 2, gap: 10 } } );
		expect( await leftOf( page, 1 ) ).toBe( 405 );
	} );

	test( 'groups', async ( { page } ) => {
		await open( page, { n: 6, o: { perView: 2, group: 2 } } );
		expect( await page.evaluate( () => window.slider.count() ) ).toBe( 3 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await leftOf( page, 2 ) ).toBe( 0 );
	} );

	test( 'centred', async ( { page } ) => {
		await open( page, {
			n: 5,
			o: { align: 'center', contain: false },
			css: '.gs { --gs-per-view: 2; }',
		} );
		expect( await leftOf( page, 0 ) ).toBe( 200 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await leftOf( page, 1 ) ).toBe( 200 );
	} );

	test( 'slides of different widths', async ( { page } ) => {
		await open( page, {
			n: 5,
			o: { perView: 'auto' },
			css: '.gs-slide { width: 300px; } .gs-slide:nth-child(2) { width: 450px; } .gs-media { width: 100% !important; }',
		} );
		await page.evaluate( () => window.slider.to( 2 ) );
		await settled( page );
		expect( await leftOf( page, 2 ) ).toBe( 0 );
		expect( await leftOf( page, 1 ) ).toBe( -450 );
	} );

	test( 'a resize keeps the slide', async ( { page } ) => {
		await open( page, { css: '.gs { width: auto; }' } );
		await page.evaluate( () => window.slider.to( 2, { instant: true } ) );
		await settled( page );
		await page.setViewportSize( { width: 700, height: 700 } );
		await page.waitForTimeout( 100 );
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		expect( await leftOf( page, 2 ) ).toBe( 0 );
		expect(
			await page.evaluate( () => window.slider.slides[ 2 ].offsetWidth )
		).toBe( 500 );
	} );

	test( 'right to left', async ( { page } ) => {
		await open( page, {
			dir: 'rtl',
			css: '.gs { --gs-per-view: 2; }',
		} );
		// The first slide is at the right.
		expect( await leftOf( page, 0 ) ).toBe( 400 );
		await page.locator( '#slider' ).focus();
		await page.keyboard.press( 'ArrowLeft' );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		expect( await leftOf( page, 1 ) ).toBe( 400 );
		// Dragging to the right goes forward.
		await drag( page, 300, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		expect( await leftOf( page, 2 ) ).toBe( 400 );
	} );
} );

test.describe( 'loop', () => {
	test( 'forward past the end', async ( { page } ) => {
		await open( page, { n: 4, o: { loop: true } } );
		for ( let i = 0; i < 5; i++ ) {
			await page.evaluate( () => window.slider.next() );
		}
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		expect( await leftOf( page, 1 ) ).toBe( 0 );
		// Back in the first round.
		expect( await page.evaluate( () => window.slider.motion.pos ) ).toBe(
			800
		);
	} );

	test( 'back before the start', async ( { page } ) => {
		await open( page, { n: 4, o: { loop: true } } );
		await page.evaluate( () => window.slider.prev() );
		await page.waitForTimeout( 60 );
		// The last slide comes in from the left while the first one leaves.
		const last = await leftOf( page, 3 );
		expect( last ).toBeLessThan( 0 );
		expect( last ).toBeGreaterThan( -800 );
		await settled( page );
		expect( await index( page ) ).toBe( 3 );
		expect( await leftOf( page, 3 ) ).toBe( 0 );
	} );

	test( 'dragging back from the first slide', async ( { page } ) => {
		await open( page, { n: 4, o: { loop: true } } );
		await drag( page, 500, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 3 );
	} );

	test( 'several per view: no hole at either end', async ( { page } ) => {
		await open( page, {
			n: 5,
			o: { loop: true },
			css: '.gs { --gs-per-view: 3; }',
		} );
		await page.evaluate( () => window.slider.to( 4, { instant: true } ) );
		await settled( page );
		const lefts = [];
		for ( let i = 0; i < 5; i++ ) {
			lefts.push( await leftOf( page, i ) );
		}
		// Slides 5, 1 and 2 fill the view, each a third of it wide. At rest
		// the track is on a whole pixel, so they are within one of theirs.
		expect( lefts[ 4 ] ).toBe( 0 );
		expect( Math.abs( lefts[ 0 ] - 266.67 ) ).toBeLessThan( 1 );
		expect( Math.abs( lefts[ 1 ] - 533.33 ) ).toBeLessThan( 1 );
	} );

	test( 'dots take the short way round', async ( { page } ) => {
		await open( page, { n: 5, o: { loop: true } } );
		await page.evaluate( () => window.slider.to( 4 ) );
		await page.waitForTimeout( 60 );
		expect(
			await page.evaluate( () => window.slider.motion.target )
		).toBe( -800 );
		await settled( page );
		expect( await index( page ) ).toBe( 4 );
	} );

	test( 'too few slides to loop: the slider does not loop', async ( { page } ) => {
		await open( page, {
			n: 3,
			o: { loop: true },
			css: '.gs { --gs-per-view: 3; }',
		} );
		expect(
			await page.evaluate( () => window.slider.layout().loop )
		).toBe( false );
	} );
} );

test.describe( 'stack', () => {
	test( 'slides lie on top of each other and fade', async ( { page } ) => {
		await open( page, { n: 3, o: { mode: 'stack' } } );
		expect( await leftOf( page, 1 ) ).toBe( 0 );
		const seen = () =>
			page.evaluate( () =>
				window.slider.slides.map(
					( el ) => getComputedStyle( el ).visibility
				)
			);
		expect( await seen() ).toEqual( [ 'visible', 'hidden', 'hidden' ] );
		await page.evaluate( () => window.slider.next() );
		await page.waitForTimeout( 80 );
		expect( await seen() ).toEqual( [ 'visible', 'visible', 'hidden' ] );
		const cover = await page.evaluate( () =>
			Number(
				getComputedStyle(
					window.slider.slides[ 1 ].querySelector( '.gs-media' )
				).opacity
			)
		);
		expect( cover ).toBeGreaterThan( 0 );
		expect( cover ).toBeLessThan( 1 );
		await settled( page );
		expect( await seen() ).toEqual( [ 'hidden', 'visible', 'hidden' ] );
	} );

	test( 'slides with an aspect-ratio and a max-height are as wide as the slider', async ( { page } ) => {
		await open( page, {
			n: 3,
			o: { mode: 'stack' },
			css: '.gs-slide { height: auto; aspect-ratio: 16 / 9; max-height: 200px; }',
		} );
		const size = await page.evaluate( () => {
			const r = window.slider.slides[ 0 ].getBoundingClientRect();
			return [ r.width, r.height ];
		} );
		expect( size ).toEqual( [ 800, 200 ] );
	} );

	test( 'dragging runs through the fade', async ( { page } ) => {
		await open( page, { n: 3, o: { mode: 'stack', loop: true } } );
		await drag( page, -500, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
	} );
} );

test.describe( 'a stack whose images wait for their place', () => {
	const asked = ( page ) => {
		const all = [];
		page.on( 'request', ( request ) => {
			const [ , name ] = request.url().match( /(\d)\.jpg\?waits/ ) || [];
			if ( name ) {
				all.push( Number( name ) );
			}
		} );
		return all;
	};
	const make = ( page, options ) =>
		page.evaluate(
			async ( [ from, given ] ) => {
				const { createSlider } = await import( `/${ from }/index.js` );
				const { stack } = await import(
					`/${ from }/plugins${ from === 'dist' ? '' : '/index' }.js`
				);
				window.slider = createSlider( document.getElementById( 'waits' ), {
					...given,
					plugins: [ stack() ],
				} );
			},
			[ process.env.FROM || 'src', options ]
		);

	test( 'before the script the first image is asked for, and no other', async ( { page } ) => {
		const all = asked( page );
		await page.goto( '/tests/plain.html' );
		await page.waitForLoadState( 'load' );
		await page.waitForTimeout( 500 );
		expect( all ).toEqual( [ 1 ] );
	} );

	test( 'then the ones next to it, and the others when they are next', async ( { page } ) => {
		const all = asked( page );
		await page.goto( '/tests/plain.html' );
		await make( page, {} );
		await expect.poll( () => all ).toEqual( [ 1, 2 ] );
		await page.waitForTimeout( 500 );
		expect( all ).toEqual( [ 1, 2 ] );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		await expect.poll( () => all ).toEqual( [ 1, 2, 3 ] );
		await page.evaluate( () => window.slider.to( 4, { instant: true } ) );
		await expect.poll( () => [ ...all ].sort() ).toEqual( [ 1, 2, 3, 4, 5 ] );
		// What the slider has done to the slides goes with it.
		await page.evaluate( () => window.slider.destroy() );
		expect(
			await page
				.locator( '#waits .gs-slide' )
				.evaluateAll( ( slides ) =>
					slides.map( ( slide ) => slide.style.contentVisibility )
				)
		).toEqual( [ '', '', '', '', '' ] );
	} );

	test( 'in a slider that goes round, the last is next to the first', async ( { page } ) => {
		const all = asked( page );
		await page.goto( '/tests/plain.html' );
		await make( page, { loop: true } );
		await expect.poll( () => [ ...all ].sort() ).toEqual( [ 1, 2, 5 ] );
		await page.waitForTimeout( 500 );
		expect( [ ...all ].sort() ).toEqual( [ 1, 2, 5 ] );
		expect( all[ 0 ] ).toBe( 1 );
	} );
} );

test.describe( 'a stack that is said in the HTML', () => {
	const seen = ( page ) =>
		page.locator( '#stacked .gs-slide' ).evaluateAll( ( slides ) =>
			slides.map( ( slide ) => {
				const { x, y, width, height } = slide.getBoundingClientRect();
				return [ getComputedStyle( slide ).visibility, x, y, width, height ].join( ' ' );
			} )
		);

	test( 'is one before the script, and nothing gives way when it comes', async ( { page } ) => {
		await page.goto( '/tests/plain.html' );
		const before = await seen( page );
		expect( before ).toEqual( [
			'visible 100 380 800 300',
			'hidden 100 380 800 300',
			'hidden 100 380 800 300',
		] );
		const made = await page.evaluate( async ( from ) => {
			const { createSlider } = await import( `/${ from }/index.js` );
			const { stack } = await import(
				`/${ from }/plugins${ from === 'dist' ? '' : '/index' }.js`
			);
			window.slider = createSlider( document.getElementById( 'stacked' ), {
				plugins: [ stack() ],
			} );
			// At once: before the slider has drawn a frame.
			return window.slider.slides.map(
				( slide ) => getComputedStyle( slide ).visibility
			);
		}, process.env.FROM || 'src' );
		expect( made ).toEqual( [ 'visible', 'hidden', 'hidden' ] );
		await expect( page.locator( '#stacked' ) ).toHaveClass( /gs-on/ );
		expect( await seen( page ) ).toEqual( before );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await seen( page ) ).toEqual( [
			'hidden 100 380 800 300',
			'visible 100 380 800 300',
			'hidden 100 380 800 300',
		] );
		// What the page has said stays when the slider ends.
		await page.evaluate( () => window.slider.destroy() );
		await expect( page.locator( '#stacked' ) ).toHaveClass( 'gs gs-stack' );
		expect( await seen( page ) ).toEqual( before );
	} );

	test.describe( 'without the script', () => {
		test.use( { javaScriptEnabled: false } );

		test( 'shows its first slide', async ( { page } ) => {
			await page.goto( '/tests/plain.html' );
			await expect( page.locator( '#stacked img' ).first() ).toBeVisible();
			await expect( page.locator( '#stacked img' ).nth( 1 ) ).toBeHidden();
		} );
	} );
} );

test.describe( 'at rest', () => {
	test( 'no frame is requested', async ( { page } ) => {
		await open( page, { o: { loop: true } } );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		await page.waitForTimeout( 100 );
		const before = await page.evaluate( () => window.frames_ );
		await page.waitForTimeout( 400 );
		expect( await page.evaluate( () => window.frames_ ) ).toBe( before );
	} );

	test( 'slides out of view are inert', async ( { page } ) => {
		await open( page, { css: '.gs { --gs-per-view: 2; }' } );
		const inert = () =>
			page.evaluate( () => window.slider.slides.map( ( el ) => el.inert ) );
		expect( await inert() ).toEqual( [ false, false, true, true, true ] );
		await page.evaluate( () => window.slider.to( 2 ) );
		await settled( page );
		expect( await inert() ).toEqual( [ true, true, false, false, true ] );
	} );

	test( 'reduced motion: moves are instant', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await open( page );
		await page.evaluate( () => window.slider.next() );
		await page.waitForTimeout( 50 );
		expect( await leftOf( page, 1 ) ).toBe( 0 );
	} );

	test( 'destroy gives the page back', async ( { page } ) => {
		await open( page );
		await page.evaluate( () => window.slider.to( 2, { instant: true } ) );
		await settled( page );
		await page.evaluate( () => window.slider.destroy() );
		const state = await page.evaluate( () => {
			const root = document.getElementById( 'slider' );
			return {
				classes: root.className,
				role: root.getAttribute( 'role' ),
				transform: root.querySelector( '.gs-track' ).style.transform,
				dots: root.querySelectorAll( '[data-gs-dot]' ).length,
				inert: [ ...root.querySelectorAll( '.gs-slide' ) ].some(
					( el ) => el.inert
				),
			};
		} );
		expect( state ).toEqual( {
			classes: 'gs',
			role: null,
			transform: '',
			dots: 0,
			inert: false,
		} );
	} );
} );

test.describe( 'without the script', () => {
	test.use( { javaScriptEnabled: false } );

	test( 'the slider is a scroller that snaps', async ( { page } ) => {
		await page.goto( '/tests/plain.html' );
		const track = page.locator( '#several .gs-track' );
		const style = await track.evaluate( ( el ) => {
			const { overflowX, scrollSnapType } = getComputedStyle( el );
			return {
				overflowX,
				scrollSnapType,
				scrolls: el.scrollWidth > el.clientWidth,
				on: el.parentElement.classList.contains( 'gs-on' ),
			};
		} );
		expect( style ).toEqual( {
			overflowX: 'auto',
			scrollSnapType: 'x mandatory',
			scrolls: true,
			on: false,
		} );
		await expect( page.locator( '#several img' ).first() ).toBeVisible();
	} );
} );
