import { expect } from '@playwright/test';

/**
 * Opens the test page.
 *
 * @param {import('@playwright/test').Page} page    Page.
 * @param {Object}                          [setup] `n`, `o` (options), `css`,
 *                                                  `dir`, `layers`, `effects`.
 */
export async function open( page, setup = {} ) {
	const query = new URLSearchParams();
	for ( const [ key, value ] of Object.entries( setup ) ) {
		query.set( key, key === 'o' ? JSON.stringify( value ) : String( value ) );
	}
	// Counts the frames the page asks for.
	await page.addInitScript( () => {
		window.frames_ = 0;
		const request = window.requestAnimationFrame.bind( window );
		window.requestAnimationFrame = ( fn ) => {
			window.frames_++;
			return request( fn );
		};
	} );
	await page.goto( `/tests/page.html?${ query }` );
	await page.waitForFunction( () => window.ready );
	await settled( page );
}

/**
 * Waits until the slider rests.
 *
 * @param {import('@playwright/test').Page} page Page.
 */
export async function settled( page ) {
	await page.waitForFunction( () => window.slider.resting );
}

/**
 * Drags over the slider with the mouse.
 *
 * @param {import('@playwright/test').Page} page   Page.
 * @param {number}                          dx     Way to the right, px.
 * @param {Object}                          [how]  How.
 * @param {number}                          [how.dy]    Way down, px.
 * @param {number}                          [how.steps] Mouse moves.
 * @param {number}                          [how.pause] Wait before letting
 *                                                      go, ms.
 * @param {number}                          [how.at]    Start, px from the
 *                                                      left of the slider.
 */
export async function drag( page, dx, { dy = 0, steps = 8, pause = 0, at = 400 } = {} ) {
	const box = await page.locator( '#slider' ).boundingBox();
	const x = box.x + at;
	const y = box.y + 150;
	await page.mouse.move( x, y );
	await page.mouse.down();
	for ( let i = 1; i <= steps; i++ ) {
		await page.mouse.move( x + ( dx * i ) / steps, y + ( dy * i ) / steps );
		await page.waitForTimeout( 16 );
	}
	if ( pause ) {
		await page.waitForTimeout( pause );
	}
	await page.mouse.up();
}

/**
 * Left edge of a slide on the screen, relative to the slider.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number}                          i    Slide.
 * @return {Promise<number>} px.
 */
export async function leftOf( page, i ) {
	return page.evaluate( ( n ) => {
		const root = document.getElementById( 'slider' ).getBoundingClientRect();
		const slide = window.slider.slides[ n ].getBoundingClientRect();
		return Math.round( slide.left - root.left ) || 0;
	}, i );
}

export const index = ( page ) => page.evaluate( () => window.slider.index );

export { expect };
