import { test, expect } from '@playwright/test';

const IDS = [
	'one',
	'several',
	'ticker',
	'photos',
	'down',
	'rows',
	'pile',
	'fan',
	'auto',
	'tall',
	'stack',
	'covers',
	'remote',
];

/** What is known about every slider of the page. */
const sliders = ( page ) =>
	page.evaluate(
		( ids ) =>
			Object.fromEntries(
				ids.map( ( id ) => {
					const root = document.getElementById( id );
					const slider = window.sliders[ id ];
					return [
						id,
						{
							made: root.dataset.made,
							on: root.classList.contains( 'gs-on' ),
							same: slider.root === root,
							names: Object.keys( slider.plugins ),
						},
					];
				} )
			),
		IDS
	);

/**
 * Scrolls to a slider, points at it and says whether its canvas draws: a
 * slider that nobody uses has none.
 */
async function drawn( page, id ) {
	const slider = page.locator( `#${ id }` );
	await slider.scrollIntoViewIfNeeded();
	const box = await slider.boundingBox();
	const bar = await page.getByTestId( 'controls' ).boundingBox();
	// Where the controls are not.
	await page.mouse.move(
		box.x + box.width / 2,
		Math.max( box.y + box.height / 2, bar.y + bar.height + 10 )
	);
	return page
		.waitForFunction(
			( name ) =>
				!! ( window.sliders[ name ].plugins.gpu || window.sliders[ name ].plugins.gl )?.canvas &&
				!! document.querySelector( `#${ name } .gs-drawn` ),
			id,
			{ timeout: 4000 }
		)
		.then(
			() => true,
			() => false
		);
}

test.beforeEach( async ( { page } ) => {
	await page.goto( '/playground/' );
	await page.waitForFunction(
		( ids ) => ids.every( ( id ) => window.sliders?.[ id ] ),
		IDS
	);
	// The controls come with a script of their own.
	await page.getByTestId( 'controls' ).getByRole( 'switch' ).waitFor();
} );

test( 'a slider that nobody uses has no canvas', async ( { page } ) => {
	await page.waitForTimeout( 500 );
	await expect( page.locator( '.gs-canvas' ) ).toHaveCount( 0 );
	expect( await drawn( page, 'several' ) ).toBe( true );
	await expect( page.locator( '#several .gs-canvas' ) ).toHaveCount( 1 );
	await expect( page.locator( '#one .gs-canvas' ) ).toHaveCount( 0 );
	// The ticker moves by itself: it has its canvas once it is in view,
	// without anybody coming.
	await page.mouse.move( 2, 300 );
	await page.locator( '#ticker' ).scrollIntoViewIfNeeded();
	await expect( page.locator( '#ticker .gs-canvas' ) ).toHaveCount( 1 );
} );

test( 'the controls stay at the top, under the bar of the site', async ( { page } ) => {
	const bar = page.getByTestId( 'controls' );
	await page.locator( '#stack' ).scrollIntoViewIfNeeded();
	expect( await page.evaluate( () => window.scrollY ) ).toBeGreaterThan( 500 );
	expect( ( await bar.boundingBox() ).y ).toBe( 72 );
	// And nothing of the page begins under them.
	await page.evaluate( () => window.scrollTo( 0, 0 ) );
	const title = await page.locator( 'h1' ).boundingBox();
	const { y, height } = await bar.boundingBox();
	expect( title.y ).toBeGreaterThan( y + height );
} );

test( 'every slider is drawn by the canvas', async ( { page } ) => {
	// Thirteen sliders, drawn without a GPU, beside the other tests.
	test.slow();
	for ( const id of IDS ) {
		expect( await drawn( page, id ), id ).toBe( true );
	}
	// By the best the browser has.
	expect(
		await page.evaluate( () => Object.keys( window.sliders.one.plugins ) )
	).toContain( process.env.LAYER === 'gpu' ? 'gpu' : 'gl' );
} );

test( 'the canvas is drawn by what is chosen', async ( { page } ) => {
	for ( const [ name, layer ] of [
		[ 'WebGL', 'gl' ],
		[ 'The best there is', process.env.LAYER === 'gpu' ? 'gpu' : 'gl' ],
	] ) {
		await page.getByRole( 'combobox', { name: 'Drawn with' } ).click();
		await page.getByRole( 'option', { name } ).click();
		expect( await drawn( page, 'one' ), name ).toBe( true );
		expect(
			await page.evaluate( () => Object.keys( window.sliders.one.plugins ) )
		).toContain( layer );
	}
} );

test( 'an effect switched on reaches every slider', async ( { page } ) => {
	test.slow();
	const before = await sliders( page );
	await page.getByRole( 'button', { name: 'Bend' } ).click();
	await expect
		.poll( async () => {
			const now = await sliders( page );
			return IDS.filter( ( id ) => now[ id ].made !== before[ id ].made );
		} )
		.toEqual( IDS );
	const after = await sliders( page );
	for ( const id of IDS ) {
		expect( after[ id ], id ).toMatchObject( { on: true, same: true } );
		expect( after[ id ].names, id ).toEqual(
			expect.arrayContaining( [ 'controls', 'canvas', 'lightbox' ] )
		);
		expect( await drawn( page, id ), id ).toBe( true );
	}
	// A bent row has a mesh, and that is another canvas than before.
	expect( await drawn( page, 'several' ) ).toBe( true );
	expect(
		await page.evaluate(
			() =>
				// WebGPU keeps to itself what it draws on.
				! window.sliders.several.plugins.gl ||
				window.sliders.several.plugins.gl.canvas
					.getContext( 'webgl2' )
					.getContextAttributes().depth
		)
	).toBe( true );
} );

test( 'the transition reaches the stack', async ( { page } ) => {
	const before = await sliders( page );
	await page.getByRole( 'combobox', { name: 'Transition' } ).click();
	await page.getByRole( 'option', { name: 'burn' } ).click();
	await expect
		.poll( async () => ( await sliders( page ) ).stack.made )
		.not.toBe( before.stack.made );
	expect( await drawn( page, 'stack' ) ).toBe( true );
} );

test( 'without the canvas the page draws, with it the canvas again', async ( { page } ) => {
	const canvas = page.getByRole( 'switch', { name: 'Canvas' } );
	await canvas.click();
	await expect( page.locator( '.gs-canvas' ) ).toHaveCount( 0 );
	await expect( page.locator( '.gs-drawn' ) ).toHaveCount( 0 );
	await expect( page.locator( '#one + p' ) ).toContainText( 'drawn by the page' );
	await canvas.click();
	for ( const id of IDS ) {
		expect( await drawn( page, id ), id ).toBe( true );
	}
} );

test( 'slides per view change without making the slider again', async ( { page } ) => {
	const before = await sliders( page );
	const width = () =>
		page.evaluate(
			() =>
				document
					.querySelector( '#several .gs-slide' )
					.getBoundingClientRect().width
		);
	const three = await width();
	await page.getByRole( 'button', { name: 'Slider' } ).click();
	const thumb = page.getByTestId( 'per-view' ).getByRole( 'slider' );
	await thumb.focus();
	await page.keyboard.press( 'ArrowLeft' );
	await page.keyboard.press( 'ArrowLeft' );
	await expect.poll( width ).toBeGreaterThan( three * 1.3 );
	expect( ( await sliders( page ) ).several.made ).toBe( before.several.made );
	// The slider has measured: its second slide is where the first ends.
	await page.keyboard.press( 'Escape' );
	await expect
		.poll( () =>
			page.evaluate( () => {
				const { left, size, gap } = window.sliders.several.layout();
				return Math.abs( left[ 1 ] - size[ 0 ] - gap ) < 1 && size[ 0 ];
			} )
		)
		.toBeCloseTo( await width(), 0 );
} );

test( 'the focus point moves what the slides show', async ( { page } ) => {
	expect( await drawn( page, 'several' ) ).toBe( true );
	const shot = () => page.locator( '#several .gs-track' ).screenshot();
	// Under the pointer there are waves, and no rest.
	await page.mouse.move( 2, 300 );
	await page.waitForFunction( () => window.sliders.several.resting );
	const middle = await shot();
	await page.getByRole( 'button', { name: 'Focus point' } ).click();
	const pad = page.getByTestId( 'focus-pad' );
	const box = await pad.boundingBox();
	await page.mouse.click( box.x + 4, box.y + box.height - 4 );
	await expect
		.poll( () =>
			page.evaluate( () =>
				getComputedStyle( document.getElementById( 'several' ) )
					.getPropertyValue( '--gs-focus' )
					.trim()
			)
		)
		.toMatch( /^[0-3]% 9[0-9]%$/ );
	await page.keyboard.press( 'Escape' );
	await page.waitForFunction( () => window.sliders.several.resting );
	await page.waitForTimeout( 300 );
	expect( Buffer.compare( middle, await shot() ) ).not.toBe( 0 );
	// The canvas took the point from the page.
	expect(
		await page.evaluate(
			() =>
				getComputedStyle( document.querySelector( '#several .gs-media' ) )
					.objectPosition
		)
	).toMatch( /^[0-3]% 9[0-9]%$/ );
} );

test( 'the slides of the stack are as wide as the stack', async ( { page } ) => {
	await page.setViewportSize( { width: 1300, height: 500 } );
	const sizes = await page.evaluate( () => {
		const root = document.getElementById( 'stack' );
		return [
			root.getBoundingClientRect().width,
			root.querySelector( '.gs-slide' ).getBoundingClientRect().width,
		];
	} );
	expect( sizes[ 1 ] ).toBe( sizes[ 0 ] );
} );

test( 'a click on a slide opens the lightbox, Escape closes it', async ( { page } ) => {
	await page.locator( '#several .gs-slide' ).nth( 1 ).click();
	const dialog = page.locator( 'dialog.gs-lightbox' );
	await expect( dialog ).toBeVisible();
	await page.waitForFunction(
		() => window.sliders.several.plugins.lightbox.progress === 1
	);
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toBeHidden();
} );

test( 'buttons outside of a slider drive it, and the page hears it', async ( { page } ) => {
	const buttons = page.getByTestId( 'remote-buttons' );
	await page.locator( '#remote' ).scrollIntoViewIfNeeded();
	await buttons.getByRole( 'button', { name: 'On' } ).click();
	await expect
		.poll( () => page.evaluate( () => window.sliders.remote.index ) )
		.toBe( 1 );
	await buttons.getByRole( 'button', { name: '5' } ).click();
	await expect
		.poll( () => page.evaluate( () => window.sliders.remote.index ) )
		.toBe( 4 );
	await expect(
		buttons.getByRole( 'button', { name: '5' } )
	).toHaveAttribute( 'aria-current', 'true' );
	await page.waitForFunction( () => window.sliders.remote.resting );
	const events = page.getByTestId( 'events' );
	await expect( events ).toContainText( 'change 4' );
	await expect( events.locator( 'li' ).first() ).toHaveText( 'settle 4' );
	// No other slider has moved.
	expect( await page.evaluate( () => window.sliders.several.index ) ).toBe( 0 );
} );

test( 'covers: turned by the canvas, or by CSS without it', async ( { page } ) => {
	expect( await drawn( page, 'covers' ) ).toBe( true );
	const mine = () =>
		page.evaluate( () =>
			Object.keys( window.sliders.covers.plugins ).filter( ( name ) =>
				[ 'canvas', 'progress', 'lightbox' ].includes( name )
			)
		);
	expect( await mine() ).toEqual( [ 'canvas', 'lightbox' ] );
	await page.getByRole( 'switch', { name: 'Canvas' } ).click();
	await expect.poll( mine ).toEqual( [ 'progress', 'lightbox' ] );
	await page.locator( '#covers' ).scrollIntoViewIfNeeded();
	await page.waitForFunction( () => window.sliders.covers.resting );
	const turned = await page.evaluate( () => {
		const { slides, index } = window.sliders.covers;
		const turn = ( slide ) =>
			getComputedStyle( slide.querySelector( '.gs-media' ) ).rotate;
		return [ turn( slides[ index ] ), turn( slides[ index + 1 ] ) ];
	} );
	expect( turned[ 0 ] ).toMatch( /^(none|y 0deg)$/ );
	// The side towards the middle goes back, as on the canvas.
	expect( turned[ 1 ] ).toBe( 'y -45deg' );
} );

test( 'the stack is a stack: one slide in view, the others hidden', async ( { page } ) => {
	await page.locator( '#stack' ).scrollIntoViewIfNeeded();
	await page.waitForFunction( () => window.sliders.stack.resting );
	expect(
		await page.evaluate( () => ( {
			stack: window.sliders.stack.layout().stack,
			shown: window.sliders.stack.slides.map(
				( slide ) => getComputedStyle( slide ).visibility
			),
		} ) )
	).toEqual( { stack: true, shown: [ 'visible', 'hidden', 'hidden', 'hidden' ] } );
} );

test( 'the ticker runs, and stops when told to', async ( { page } ) => {
	await page.locator( '#ticker' ).scrollIntoViewIfNeeded();
	const pos = () => page.evaluate( () => window.sliders.ticker.motion.pos );
	const from = await pos();
	await expect.poll( pos ).toBeGreaterThan( from + 20 );
	await page.locator( '#ticker [data-gs-pause]' ).click();
	await page.waitForTimeout( 200 );
	const then = await pos();
	await page.waitForTimeout( 300 );
	expect( await pos() ).toBe( then );
} );

test( 'a thumbnail takes the photos to its slide', async ( { page } ) => {
	await page.locator( '#thumbs' ).scrollIntoViewIfNeeded();
	const third = page.locator( '#thumbs .gs-slide' ).nth( 2 );
	await expect( third ).toHaveAttribute( 'role', 'button' );
	await third.click();
	await expect
		.poll( () => page.evaluate( () => window.sliders.photos.index ) )
		.toBe( 2 );
	await expect( third ).toHaveClass( /gs-active/ );
	// Made again with other settings, the photos still have them.
	await page.getByRole( 'button', { name: 'Bend' } ).click();
	await page.locator( '#thumbs .gs-slide' ).nth( 4 ).click();
	await expect
		.poll( () => page.evaluate( () => window.sliders.photos.index ) )
		.toBe( 4 );
} );

test( 'downwards: the keys go down, the slides are below each other', async ( { page } ) => {
	await page.locator( '#down' ).scrollIntoViewIfNeeded();
	const tops = await page.evaluate( () =>
		[ ...document.querySelectorAll( '#down .gs-slide' ) ]
			.slice( 0, 2 )
			.map( ( slide ) => slide.getBoundingClientRect().top )
	);
	expect( tops[ 1 ] ).toBeGreaterThan( tops[ 0 ] + 100 );
	await page.locator( '#down' ).focus();
	await page.keyboard.press( 'ArrowDown' );
	await expect
		.poll( () => page.evaluate( () => window.sliders.down.index ) )
		.toBe( 1 );
} );

test( 'a slider that shows one slide at a time takes the transition, and moves without one', async ( { page } ) => {
	const stacks = () =>
		page.evaluate( () =>
			[ 'one', 'photos', 'stack', 'several' ].map(
				( id ) => !! window.sliders[ id ].layout().stack
			)
		);
	expect( await stacks() ).toEqual( [ true, true, true, false ] );
	expect( await drawn( page, 'one' ) ).toBe( true );
	// It goes on as a stack does: the next slide is where the first was.
	await page.locator( '#one [data-gs-next]' ).click();
	// The second slide is a film: a slider that shows one does not rest.
	await page.waitForFunction( () => {
		const { motion, index } = window.sliders.one;
		return index === 1 && motion.pos === motion.target;
	} );
	expect(
		await page.evaluate( () => {
			const { slides, index, root } = window.sliders.one;
			return (
				slides[ index ].getBoundingClientRect().x -
				root.getBoundingClientRect().x
			);
		} )
	).toBe( 0 );

	const before = await sliders( page );
	await page.getByRole( 'combobox', { name: 'Transition' } ).click();
	await page.getByRole( 'option', { name: 'None: the slides move' } ).click();
	await expect
		.poll( async () => ( await sliders( page ) ).one.made )
		.not.toBe( before.one.made );
	expect( await stacks() ).toEqual( [ false, false, true, false ] );
	// And it is where it was.
	expect( await page.evaluate( () => window.sliders.one.index ) ).toBe( 1 );
	expect( await drawn( page, 'one' ) ).toBe( true );
} );

test( 'without the canvas nothing is a stack but the stack', async ( { page } ) => {
	await page.getByRole( 'switch', { name: 'Canvas' } ).click();
	await expect
		.poll( () =>
			page.evaluate( () =>
				[ 'one', 'photos', 'stack' ].map(
					( id ) => !! window.sliders[ id ].layout().stack
				)
			)
		)
		.toEqual( [ false, false, true ] );
} );

test( 'a click on the cover at the edge opens that cover, not the one whose place it is', async ( { page } ) => {
	test.slow();
	expect( await drawn( page, 'covers' ) ).toBe( true );
	// The covers at the edges are drawn once their pictures are there.
	const at = await page
		.waitForFunction( () => {
			const { plugins, root, slides } = window.sliders.covers;
			const box = root.getBoundingClientRect();
			const bar = document
				.querySelector( '[data-testid="controls"]' )
				.getBoundingClientRect();
			const x = box.left + 12;
			const y = Math.max( box.top + box.height * 0.75, bar.bottom + 10 );
			const seen = plugins.hit?.at( x, y );
			const under = slides.indexOf(
				document.elementFromPoint( x, y ).closest( '.gs-slide' )
			);
			return seen >= 0 && seen !== under && { x, y, seen, under };
		} )
		.then( ( found ) => found.jsonValue() );
	await page.evaluate( () => {
		window.opened = [];
		window.sliders.covers.on( 'lightbox:open', ( index ) =>
			window.opened.push( index )
		);
	} );
	await page.mouse.click( at.x, at.y );
	await expect( page.locator( '.gs-lightbox' ) ).toBeVisible();
	expect( await page.evaluate( () => window.opened ) ).toEqual( [ at.seen ] );
} );

test( 'a click on a slider that moves opens the lightbox', async ( { page } ) => {
	const slider = page.locator( '#several' );
	await slider.scrollIntoViewIfNeeded();
	const box = await slider.boundingBox();
	const bar = await page.getByTestId( 'controls' ).boundingBox();
	await page.evaluate( () => {
		window.opened = [];
		window.sliders.several.on( 'lightbox:open', ( index ) =>
			window.opened.push( index )
		);
		window.sliders.several.set( { duration: 1500 } );
		window.sliders.several.next();
	} );
	await page.waitForTimeout( 150 );
	expect( await page.evaluate( () => window.sliders.several.resting ) ).toBe( false );
	await page.mouse.click(
		box.x + box.width / 2,
		Math.max( box.y + box.height / 2, bar.y + bar.height + 10 )
	);
	await expect( page.locator( '.gs-lightbox' ) ).toBeVisible();
	expect( await page.evaluate( () => window.opened.length ) ).toBe( 1 );
} );
