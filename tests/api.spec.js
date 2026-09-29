import { test } from '@playwright/test';
import { open, settled, painted, drag, leftOf, index, draws, difference, expect } from './helpers.js';

/** Records every event of the slider from now on. */
const record = ( page ) =>
	page.evaluate( () => {
		window.heard = [];
		window.slider.on( '*', ( name, detail ) => {
			if ( name !== 'frame' ) {
				window.heard.push( [
					name,
					typeof detail === 'object' ? null : detail,
				] );
			}
		} );
	} );
const heard = ( page, ...names ) =>
	page.evaluate(
		( only ) =>
			window.heard.filter(
				( [ name ] ) => ! only.length || only.includes( name )
			),
		names
	);

test.describe( 'events', () => {
	test( 'listeners get what the event says, then the slider', async ( { page } ) => {
		await open( page );
		const got = await page.evaluate(
			() =>
				new Promise( ( done ) => {
					window.slider.on( 'change', ( detail, slider ) =>
						done( [ detail, slider === window.slider, slider.previous ] )
					);
					window.slider.next();
				} )
		);
		expect( got ).toEqual( [ 1, true, 0 ] );
	} );

	test( 'ready waits for the listeners, and listeners can be options', async ( { page } ) => {
		await open( page );
		const got = await page.evaluate( async () => {
			window.slider.destroy();
			const said = [];
			const slider = window.lib.createSlider(
				document.getElementById( 'slider' ),
				{ on: { measure: () => said.push( 'measure, by option' ) } }
			);
			slider.on( 'ready', ( it ) => said.push( [ 'ready', it === slider ] ) );
			await new Promise( ( done ) => setTimeout( done, 50 ) );
			window.slider = slider;
			return said;
		} );
		expect( got[ 0 ] ).toBe( 'measure, by option' );
		expect( got ).toContainEqual( [ 'ready', true ] );
	} );

	test( 'a move: change, then settle', async ( { page } ) => {
		await open( page );
		await record( page );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await heard( page, 'change', 'settle' ) ).toEqual( [
			[ 'change', 1 ],
			[ 'settle', 1 ],
		] );
	} );

	test( 'a drag: dragstart, dragend with its velocity, change, settle', async ( { page } ) => {
		await open( page );
		await record( page );
		await drag( page, -500, { pause: 150 } );
		await settled( page );
		const names = ( await heard( page, 'dragstart', 'dragend', 'change', 'settle' ) )
			.map( ( [ name ] ) => name );
		expect( names ).toEqual( [ 'dragstart', 'dragend', 'change', 'settle' ] );
		expect( ( await heard( page, 'dragend' ) )[ 0 ][ 1 ] ).toBe( 0 );
	} );

	test( 'visible says what changes, when it changes', async ( { page } ) => {
		await open( page, { css: '.ss { --ss-per-view: 2; }' } );
		const got = await page.evaluate(
			() =>
				new Promise( ( done ) => {
					const said = [];
					window.slider.on( 'visible', ( slides ) =>
						said.push( [ 'visible', slides.join() ] )
					);
					window.slider.on( 'settle', () => done( said ) );
					window.slider.to( 3 );
				} )
		);
		expect( got.at( -1 ) ).toEqual( [ 'visible', '3,4' ] );
		// On the way the slides between were in view.
		expect( got.map( ( [ , slides ] ) => slides ) ).toContain( '1,2,3' );
	} );

	test( 'click says the slide; the end of a drag is no click', async ( { page } ) => {
		await open( page, { css: '.ss { --ss-per-view: 2; }' } );
		await page.evaluate( () => {
			window.clicked = [];
			window.slider.on( 'click', ( { index: at, event } ) =>
				window.clicked.push( [ at, event.type ] )
			);
		} );
		await drag( page, -100, { pause: 150 } );
		await settled( page );
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [] );
		await page.locator( '.ss-slide[data-i="1"]' ).click( {
			position: { x: 200, y: 200 },
		} );
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [
			[ 1, 'click' ],
		] );
	} );

	test( 'a click on a slider that moves holds it, and is a click on the slide under it', async ( { page } ) => {
		await open( page, { css: '.ss { --ss-per-view: 2; }', o: { duration: 1500 } } );
		await page.evaluate( () => {
			window.clicked = [];
			window.slider.on( 'click', ( { index: at } ) => window.clicked.push( at ) );
			// The slide the pointer came down on.
			window.addEventListener(
				'pointerdown',
				( event ) => {
					window.under = Number( event.target.closest( '.ss-slide' ).dataset.i );
					window.moving = ! window.slider.resting;
				},
				true
			);
			window.slider.next();
		} );
		await page.waitForTimeout( 150 );
		await page.mouse.click( 300, 200 );
		const { clicked, under, moving } = await page.evaluate( () => ( {
			clicked: window.clicked,
			under: window.under,
			moving: window.moving,
		} ) );
		expect( moving ).toBe( true );
		expect( clicked ).toEqual( [ under ] );
		// It goes on to a snap.
		await settled( page );
		expect( await leftOf( page, await index( page ) ) ).toBe( 0 );
	} );

	test( 'autoplay says when it stops and goes on; measure, destroy', async ( { page } ) => {
		await open( page, { o: { autoplay: 5000 } } );
		await record( page );
		const button = page.locator( '#slider > [data-ss-pause]' );
		await button.click();
		await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );
		expect(
			await page.evaluate( () => window.slider.plugins.autoplay.paused )
		).toBe( true );
		await button.click();
		expect(
			( await heard( page, 'autoplay:play', 'autoplay:pause' ) ).map(
				( [ name ] ) => name
			)
		).toEqual( [ 'autoplay:pause', 'autoplay:play' ] );
		await page.setViewportSize( { width: 900, height: 700 } );
		await page.evaluate( () => window.slider.update() );
		expect( ( await heard( page, 'measure' ) ).length ).toBeGreaterThan( 0 );
		await page.evaluate( () => window.slider.destroy() );
		expect( ( await heard( page, 'destroy' ) ).length ).toBe( 1 );
	} );

	test( 'once and off', async ( { page } ) => {
		await open( page );
		const got = await page.evaluate( async () => {
			const said = [];
			const often = ( at ) => said.push( [ 'often', at ] );
			window.slider.once( 'change', ( at ) => said.push( [ 'once', at ] ) );
			window.slider.on( 'change', often );
			const remove = window.slider.on( 'change', ( at ) =>
				said.push( [ 'removed', at ] )
			);
			remove();
			window.slider.next();
			window.slider.next();
			window.slider.off( 'change', often );
			window.slider.next();
			return said;
		} );
		expect( got ).toEqual( [
			[ 'once', 1 ],
			[ 'often', 1 ],
			[ 'often', 2 ],
		] );
	} );
} );

test.describe( 'what the slider knows', () => {
	test( 'canNext, canPrev, progress, visible, previous', async ( { page } ) => {
		await open( page, { n: 5, css: '.ss { --ss-per-view: 2; }' } );
		const state = () =>
			page.evaluate( () => {
				const { canNext, canPrev, progress, previous } = window.slider;
				return {
					canNext,
					canPrev,
					progress: Math.round( progress * 100 ) / 100,
					previous,
					visible: window.slider.visible(),
					count: window.slider.count(),
				};
			} );
		expect( await state() ).toEqual( {
			canNext: true,
			canPrev: false,
			progress: 0,
			previous: 0,
			visible: [ 0, 1 ],
			count: 4,
		} );
		await page.evaluate( () => window.slider.to( 3 ) );
		await settled( page );
		expect( await state() ).toEqual( {
			canNext: false,
			canPrev: true,
			progress: 1,
			previous: 0,
			visible: [ 3, 4 ],
			count: 4,
		} );
		await page.evaluate( () => window.slider.to( 1 ) );
		await settled( page );
		expect( ( await state() ).progress ).toBe( 0.33 );
		expect( ( await state() ).previous ).toBe( 3 );
	} );

	test( 'a looping slider can always go on', async ( { page } ) => {
		await open( page, { n: 4, o: { loop: true } } );
		expect(
			await page.evaluate( () => [
				window.slider.canPrev,
				window.slider.canNext,
			] )
		).toEqual( [ true, true ] );
	} );

	test( 'toSlide goes to the snap of a slide', async ( { page } ) => {
		await open( page, { n: 8, o: { perView: 2, group: 2 } } );
		await page.evaluate( () => window.slider.toSlide( 5 ) );
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		expect( await leftOf( page, 4 ) ).toBe( 0 );
	} );

	test( 'set changes options of a slider that exists', async ( { page } ) => {
		await open( page, { n: 6 } );
		await page.evaluate( () => window.slider.to( 5, { instant: true } ) );
		await settled( page );
		expect( await page.evaluate( () => window.slider.canNext ) ).toBe( false );
		await page.evaluate( () =>
			window.slider.set( { loop: true, perView: 2, gap: 20 } )
		);
		await settled( page );
		expect( await page.evaluate( () => window.slider.canNext ) ).toBe( true );
		expect(
			await page.evaluate( () => window.slider.slides[ 0 ].offsetWidth )
		).toBe( 390 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await index( page ) ).toBe( 0 );
	} );

	test( 'grab, drag and release move it as a pointer would', async ( { page } ) => {
		await open( page );
		await page.evaluate( () => {
			const { slider } = window;
			slider.grab();
			slider.drag( 500 );
			slider.release( 0, 0 );
		} );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
	} );
} );

test.describe( 'controls anywhere on the page', () => {
	test( 'with the id of the slider around them', async ( { page } ) => {
		await open( page );
		const back = page.locator( '#outside [data-ss-prev]' );
		const on = page.locator( '#outside [data-ss-next]' );
		await expect( back ).toBeDisabled();
		await on.click();
		await on.click();
		expect( await index( page ) ).toBe( 2 );
		await expect( back ).toBeEnabled();
		await back.click();
		expect( await index( page ) ).toBe( 1 );
		const fourth = page.locator( '#outside [data-ss-to]' );
		await fourth.click();
		await settled( page );
		expect( await index( page ) ).toBe( 3 );
		await expect( fourth ).toHaveAttribute( 'aria-current', 'true' );
	} );

	test( 'given as options: an element or a selector', async ( { page } ) => {
		await open( page );
		await page.evaluate( () => {
			window.slider.destroy();
			document.body.insertAdjacentHTML(
				'afterbegin',
				'<p class="mine"><button class="go-back">b</button><span class="my-dots"></span></p>'
			);
			window.slider = window.lib.createSlider(
				document.getElementById( 'slider' ),
				{
					next: document.getElementById( 'lonely' ),
					prev: '.go-back',
					dots: '.my-dots',
				}
			);
		} );
		await page.locator( '#lonely' ).click();
		await page.locator( '#lonely' ).click();
		expect( await index( page ) ).toBe( 2 );
		await page.locator( '.go-back' ).click();
		expect( await index( page ) ).toBe( 1 );
		await expect( page.locator( '.my-dots button' ) ).toHaveCount( 5 );
		await page.locator( '.my-dots button' ).nth( 4 ).click();
		await settled( page );
		expect( await index( page ) ).toBe( 4 );
		await expect( page.locator( '#lonely' ) ).toBeDisabled();
	} );

	test( 'controls that come later', async ( { page } ) => {
		await open( page );
		await page.evaluate( () =>
			document.body.insertAdjacentHTML(
				'afterbegin',
				'<button id="late" data-ss-for="slider" data-ss-next>late</button>'
			)
		);
		await page.locator( '#late' ).click();
		expect( await index( page ) ).toBe( 1 );
	} );

	test( 'another slider of the page is left alone', async ( { page } ) => {
		await open( page );
		const other = await page.evaluate( () => {
			const copy = document.getElementById( 'slider' ).cloneNode( true );
			copy.id = 'other';
			document.body.append( copy );
			window.other = window.lib.createSlider( copy );
			return true;
		} );
		expect( other ).toBe( true );
		await page.locator( '#outside [data-ss-next]' ).click();
		await page.locator( '#slider > [data-ss-next]' ).click();
		expect( await index( page ) ).toBe( 2 );
		expect( await page.evaluate( () => window.other.index ) ).toBe( 0 );
		await page.locator( '#other > [data-ss-next]' ).click();
		expect( await page.evaluate( () => window.other.index ) ).toBe( 1 );
		expect( await index( page ) ).toBe( 2 );
	} );
} );

test.describe( 'slides that come and go', () => {
	const add = ( page ) =>
		page.evaluate( () => {
			window.slider.track.insertAdjacentHTML(
				'beforeend',
				'<div class="ss-slide" data-i="new"><img class="ss-media" src="../media/8.jpg" alt=""></div>'
			);
		} );

	test( 'a slide that is added is a slide', async ( { page } ) => {
		await open( page, { n: 3 } );
		await record( page );
		await add( page );
		await expect
			.poll( () => page.evaluate( () => window.slider.count() ) )
			.toBe( 4 );
		expect( ( await heard( page, 'slides' ) ).length ).toBe( 1 );
		await expect( page.locator( '#slider > [data-ss-dots] button' ) ).toHaveCount( 4 );
		await page.evaluate( () => window.slider.to( 3 ) );
		await settled( page );
		expect( await leftOf( page, 3 ) ).toBe( 0 );
		expect(
			await page.evaluate( () => ( {
				role: window.slider.slides[ 3 ].getAttribute( 'role' ),
				label: window.slider.slides[ 3 ].getAttribute( 'aria-label' ),
				first: window.slider.slides[ 0 ].getAttribute( 'aria-label' ),
			} ) )
		).toEqual( { role: 'group', label: '4 / 4', first: '1 / 4' } );
	} );

	test( 'a slide that is removed is none', async ( { page } ) => {
		await open( page, { n: 4 } );
		await page.evaluate( () => window.slider.to( 3, { instant: true } ) );
		await settled( page );
		await page.evaluate( () => window.slider.slides[ 3 ].remove() );
		await expect
			.poll( () => page.evaluate( () => window.slider.count() ) )
			.toBe( 3 );
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		expect( await leftOf( page, 2 ) ).toBe( 0 );
	} );

	test( 'the canvas draws the slide that was added', async ( { page } ) => {
		await open( page, { n: 3, plugins: 'gl' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		await add( page );
		await expect
			.poll( () => page.evaluate( () => window.slider.count() ) )
			.toBe( 4 );
		await page.evaluate( () => window.slider.to( 3, { instant: true } ) );
		await settled( page );
		await painted( page );
		const shown = await page.locator( '#slider .ss-track' ).screenshot();
		await open( page, { n: 3 } );
		await add( page );
		await page.evaluate( () => window.slider.to( 3, { instant: true } ) );
		await settled( page );
		await page.evaluate( () =>
			Promise.all( [ ...document.images ].map( ( i ) => i.decode() ) )
		);
		const { mean } = await difference(
			page,
			shown,
			await page.locator( '#slider .ss-track' ).screenshot()
		);
		expect( mean ).toBeLessThan( 2 );
	} );
} );

test.describe( 'plugins', () => {
	test( 'a plugin is told what happens, and the slider has it by its name', async ( { page } ) => {
		await open( page, { n: 3 } );
		const got = await page.evaluate( async () => {
			window.slider.destroy();
			const calls = [];
			const mine = ( options ) => ( slider ) => ( {
				name: 'mine',
				hello: () => `hello ${ options.who }`,
				measure: ( view ) => calls.push( [ 'measure', view.layout.snaps.length ] ),
				slides: () => calls.push( [ 'slides', slider.slides.length ] ),
				frame: ( view ) => calls.push( [ 'frame', typeof view.places[ 0 ].p ] ),
				destroy: () => calls.push( [ 'destroy' ] ),
			} );
			const slider = window.lib.createSlider(
				document.getElementById( 'slider' ),
				{ plugins: [ mine( { who: 'you' } ) ] }
			);
			const said = slider.plugins.mine.hello();
			slider.next();
			await new Promise( ( done ) => slider.on( 'settle', done ) );
			slider.track.append( slider.slides[ 0 ].cloneNode( true ) );
			await new Promise( ( done ) => slider.on( 'slides', done ) );
			slider.destroy();
			const names = [ ...new Set( calls.map( ( [ name ] ) => name ) ) ];
			return { said, names, slides: calls.find( ( [ n ] ) => n === 'slides' ) };
		} );
		expect( got ).toEqual( {
			said: 'hello you',
			names: [ 'measure', 'frame', 'slides', 'destroy' ],
			slides: [ 'slides', 4 ],
		} );
	} );

	test( 'a plugin that is busy gets frames, one that is not does not', async ( { page } ) => {
		await open( page, { n: 3 } );
		const frames = await page.evaluate( async () => {
			let busy = true;
			let count = 0;
			window.slider.use( () => ( {
				frame: () => count++,
				busy: () => busy,
			} ) );
			await new Promise( ( done ) => setTimeout( done, 300 ) );
			const while_ = count;
			busy = false;
			await new Promise( ( done ) => setTimeout( done, 100 ) );
			const after = count;
			await new Promise( ( done ) => setTimeout( done, 300 ) );
			return { while_, more: count - after };
		} );
		expect( frames.while_ ).toBeGreaterThan( 5 );
		expect( frames.more ).toBe( 0 );
	} );

	test( 'plugins have events of their own', async ( { page } ) => {
		await open( page, { n: 3, plugins: 'gl,lightbox', open: 100 } );
		await record( page );
		await page.evaluate( () => window.slider.plugins.lightbox.open( 1 ) );
		await page.waitForFunction(
			() => window.slider.plugins.lightbox.progress === 1
		);
		await page.keyboard.press( 'Escape' );
		await page.waitForFunction(
			() => ! window.slider.plugins.lightbox.slider
		);
		expect( await heard( page, 'lightbox:open', 'lightbox:close' ) ).toEqual( [
			[ 'lightbox:open', 1 ],
			[ 'lightbox:close', 1 ],
		] );
	} );

	test( 'progress: the slides know where they are, for CSS', async ( { page } ) => {
		await open( page, {
			n: 5,
			plugins: 'progress',
			css: '.ss { --ss-per-view: 3; } .ss-slide { opacity: calc( 1 - var(--ss-away) * 0.5 ); }',
			o: { align: 'center', contain: false },
		} );
		const told = () =>
			page.evaluate( () =>
				window.slider.slides.map( ( el ) => [
					Number( el.style.getPropertyValue( '--ss-p' ) ),
					Number( el.style.getPropertyValue( '--ss-away' ) ),
					Number( getComputedStyle( el ).opacity ),
				] )
			);
		expect( ( await told() ).slice( 0, 3 ) ).toEqual( [
			[ 0, 0, 1 ],
			[ 1, 1, 0.5 ],
			[ 2, 1, 0.5 ],
		] );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( ( await told() ).slice( 0, 3 ) ).toEqual( [
			[ -1, 1, 0.5 ],
			[ 0, 0, 1 ],
			[ 1, 1, 0.5 ],
		] );
		await page.evaluate( () => window.slider.destroy() );
		expect(
			await page.evaluate( () =>
				window.slider.slides[ 0 ].style.getPropertyValue( '--ss-p' )
			)
		).toBe( '' );
	} );

	test( 'coverflow: the slides beside the active one step back', async ( { page } ) => {
		const setup = {
			n: 5,
			css: '.ss { --ss-per-view: 3; --ss-gap: 10px; }',
			o: { align: 'center', contain: false, start: 2 },
		};
		await open( page, setup );
		const flat = await page.locator( '#slider' ).screenshot();
		await open( page, { ...setup, plugins: 'gl', effects: 'coverflow' } );
		test.skip( ! ( await draws( page ) ), 'No WebGL 2 in this browser.' );
		await painted( page );
		const turned = await page.locator( '#slider' ).screenshot();
		// The middle third is the active slide, as it was; the sides are not.
		const parts = await page.evaluate(
			async ( [ a, b ] ) => {
				const read = async ( file ) => {
					const bitmap = await createImageBitmap(
						new Blob( [ Uint8Array.from( atob( file ), ( c ) => c.charCodeAt( 0 ) ) ], { type: 'image/png' } )
					);
					const canvas = new OffscreenCanvas( bitmap.width, bitmap.height );
					const context = canvas.getContext( '2d' );
					context.drawImage( bitmap, 0, 0 );
					return context.getImageData( 0, 0, bitmap.width, bitmap.height );
				};
				const [ one, two ] = [ await read( a ), await read( b ) ];
				const mean = ( from, to ) => {
					let sum = 0;
					let n = 0;
					for ( let y = 0; y < one.height; y += 3 ) {
						for ( let x = Math.floor( from * one.width ); x < to * one.width; x += 3 ) {
							const i = 4 * ( y * one.width + x );
							sum += Math.abs( one.data[ i ] - two.data[ i ] );
							n++;
						}
					}
					return sum / n;
				};
				return { middle: mean( 0.38, 0.62 ), side: mean( 0.02, 0.3 ) };
			},
			[ flat.toString( 'base64' ), turned.toString( 'base64' ) ]
		);
		expect( parts.middle ).toBeLessThan( 3 );
		expect( parts.side ).toBeGreaterThan( 10 );
	} );
} );

test.describe( 'the core alone', () => {
	test( 'moves by drag and by script, and has nothing else', async ( { page } ) => {
		await open( page, { core: 1 } );
		expect(
			await page.evaluate( () => Object.keys( window.slider.plugins ) )
		).toEqual( [] );
		await drag( page, -500, { pause: 150 } );
		await settled( page );
		expect( await index( page ) ).toBe( 1 );
		await page.evaluate( () => window.slider.next() );
		await settled( page );
		expect( await index( page ) ).toBe( 2 );
		// No arrows, no dots, no keys.
		await page.locator( '#slider > [data-ss-next]' ).click();
		await page.locator( '#slider' ).press( 'ArrowRight' ).catch( () => {} );
		expect( await index( page ) ).toBe( 2 );
		await expect( page.locator( '#slider .ss-dot' ) ).toHaveCount( 0 );
		// What assistive technology needs is there.
		expect(
			await page.evaluate( () => [
				window.slider.root.getAttribute( 'role' ),
				window.slider.slides[ 0 ].getAttribute( 'aria-label' ),
				window.slider.slides[ 4 ].inert,
			] )
		).toEqual( [ 'region', '1 / 5', true ] );
	} );

	test( 'plugins one by one', async ( { page } ) => {
		await open( page, { core: 1, plugins: 'controls,keyboard' } );
		expect(
			await page.evaluate( () => Object.keys( window.slider.plugins ) )
		).toEqual( [ 'controls', 'keyboard' ] );
		await page.locator( '#slider > [data-ss-next]' ).click();
		expect( await index( page ) ).toBe( 1 );
		await page.locator( '#slider' ).focus();
		await page.keyboard.press( 'ArrowRight' );
		expect( await index( page ) ).toBe( 2 );
		await expect( page.locator( '#slider .ss-dot' ) ).toHaveCount( 5 );
		await page.evaluate( () => window.slider.destroy() );
		await expect( page.locator( '#slider .ss-dot' ) ).toHaveCount( 0 );
		expect(
			await page.evaluate( () =>
				window.slider.root.hasAttribute( 'tabindex' )
			)
		).toBe( false );
	} );
} );
