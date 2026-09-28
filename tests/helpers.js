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
	await page.evaluate( () =>
		Promise.all(
			[ ...document.images ].map( ( image ) =>
				image.decode().catch( () => {} )
			)
		)
	);
	await settled( page );
}

/**
 * Waits until the canvas shows the media of every slide in view.
 *
 * @param {import('@playwright/test').Page} page Page.
 */
export async function painted( page ) {
	await page.waitForFunction( () => {
		const { slides, view } = window.slider;
		return slides.every(
			( slide, i ) =>
				! view.places[ i ].visible ||
				slide.querySelector( '.ss-media.ss-drawn' )
		);
	} );
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

/**
 * How much two screenshots of the same size differ.
 *
 * @param {import('@playwright/test').Page} page Page, to decode them in.
 * @param {Buffer}                          a    PNG.
 * @param {Buffer}                          b    PNG.
 * @return {Promise<Object>} `mean`: difference per channel, 0 to 255, on
 *                           average; `far`: share of the pixels that differ
 *                           by more than 32 in a channel.
 */
export async function difference( page, a, b ) {
	return page.evaluate(
		async ( files ) => {
			const [ one, two ] = await Promise.all(
				files.map( async ( file ) => {
					const bytes = Uint8Array.from( atob( file ), ( c ) =>
						c.charCodeAt( 0 )
					);
					const bitmap = await createImageBitmap(
						new Blob( [ bytes ], { type: 'image/png' } )
					);
					const canvas = new OffscreenCanvas(
						bitmap.width,
						bitmap.height
					);
					const context = canvas.getContext( '2d' );
					context.drawImage( bitmap, 0, 0 );
					return context.getImageData(
						0,
						0,
						bitmap.width,
						bitmap.height
					);
				} )
			);
			if ( one.width !== two.width || one.height !== two.height ) {
				return { mean: 255, far: 1 };
			}
			let sum = 0;
			let far = 0;
			for ( let i = 0; i < one.data.length; i += 4 ) {
				let most = 0;
				for ( let c = 0; c < 3; c++ ) {
					const d = Math.abs( one.data[ i + c ] - two.data[ i + c ] );
					sum += d;
					most = Math.max( most, d );
				}
				far += most > 32 ? 1 : 0;
			}
			const pixels = one.data.length / 4;
			return { mean: sum / pixels / 3, far: far / pixels };
		},
		[ a.toString( 'base64' ), b.toString( 'base64' ) ]
	);
}

/**
 * Whether the canvas layer of the slider draws.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @return {Promise<boolean>} Draws.
 */
export const draws = ( page ) =>
	page
		.waitForFunction( () => !! window.slider.layers[ 0 ]?.canvas, null, {
			// The layer hears that it is on the screen a moment after it
			// was made.
			timeout: 2000,
		} )
		.then(
			() => true,
			() => false
		);
