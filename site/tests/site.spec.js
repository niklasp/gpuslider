import { test, expect } from '@playwright/test';

const IDS = [ 'one', 'several', 'auto', 'tall', 'stack' ];

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
							on: root.classList.contains( 'ss-on' ),
							same: slider.root === root,
							layers: slider.layers.length,
						},
					];
				} )
			),
		IDS
	);

/** Scrolls to a slider and says whether its canvas draws. */
async function drawn( page, id ) {
	await page.locator( `#${ id }` ).scrollIntoViewIfNeeded();
	return page
		.waitForFunction(
			( name ) =>
				!! window.sliders[ name ].layers[ 0 ]?.canvas &&
				!! document.querySelector( `#${ name } .ss-drawn` ),
			id,
			{ timeout: 4000 }
		)
		.then(
			() => true,
			() => false
		);
}

test.beforeEach( async ( { page } ) => {
	await page.goto( '/' );
	await page.waitForFunction(
		( ids ) => ids.every( ( id ) => window.sliders?.[ id ] ),
		IDS
	);
} );

test( 'the controls stay at the top', async ( { page } ) => {
	const bar = page.getByTestId( 'controls' );
	await page.locator( '#stack' ).scrollIntoViewIfNeeded();
	expect( await page.evaluate( () => window.scrollY ) ).toBeGreaterThan( 500 );
	expect( ( await bar.boundingBox() ).y ).toBe( 0 );
	// And nothing of the page begins under them.
	await page.evaluate( () => window.scrollTo( 0, 0 ) );
	const title = await page.locator( 'h1' ).boundingBox();
	expect( title.y ).toBeGreaterThan( ( await bar.boundingBox() ).height );
} );

test( 'every slider is drawn by the canvas', async ( { page } ) => {
	for ( const id of IDS ) {
		expect( await drawn( page, id ), id ).toBe( true );
	}
} );

test( 'an effect switched on reaches every slider', async ( { page } ) => {
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
		expect( after[ id ], id ).toMatchObject( { on: true, same: true, layers: 2 } );
		expect( await drawn( page, id ), id ).toBe( true );
	}
	// A bent row has a mesh, and that is another canvas than before.
	expect( await drawn( page, 'several' ) ).toBe( true );
	expect(
		await page.evaluate( () =>
			window.sliders.several.layers[ 0 ].canvas
				.getContext( 'webgl2' )
				.getContextAttributes().depth
		)
	).toBe( true );
} );

test( 'the transition reaches the stack', async ( { page } ) => {
	const before = await sliders( page );
	await page.getByRole( 'combobox' ).click();
	await page.getByRole( 'option', { name: 'burn' } ).click();
	await expect
		.poll( async () => ( await sliders( page ) ).stack.made )
		.not.toBe( before.stack.made );
	expect( await drawn( page, 'stack' ) ).toBe( true );
} );

test( 'without the canvas the page draws, with it the canvas again', async ( { page } ) => {
	const canvas = page.getByRole( 'switch', { name: 'Canvas' } );
	await canvas.click();
	await expect( page.locator( '.ss-canvas' ) ).toHaveCount( 0 );
	await expect( page.locator( '.ss-drawn' ) ).toHaveCount( 0 );
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
					.querySelector( '#several .ss-slide' )
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
	const shot = () => page.locator( '#several .ss-track' ).screenshot();
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
					.getPropertyValue( '--ss-focus' )
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
				getComputedStyle( document.querySelector( '#several .ss-media' ) )
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
			root.querySelector( '.ss-slide' ).getBoundingClientRect().width,
		];
	} );
	expect( sizes[ 1 ] ).toBe( sizes[ 0 ] );
} );

test( 'a click on a slide opens the lightbox, Escape closes it', async ( { page } ) => {
	await page.locator( '#several .ss-slide' ).nth( 1 ).click();
	const dialog = page.locator( 'dialog.ss-lightbox' );
	await expect( dialog ).toBeVisible();
	await page.waitForFunction(
		() => window.sliders.several.layers[ 1 ].progress === 1
	);
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toBeHidden();
} );
