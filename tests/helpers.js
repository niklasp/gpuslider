import { expect } from '@playwright/test';

/** Whether the canvas is drawn by WebGPU: LAYER=gpu. */
export const GPU = process.env.LAYER === 'gpu';

/**
 * A page whose browser cannot draw the canvas. Before the page is opened.
 *
 * @param {import('@playwright/test').Page} page Page.
 */
export const unable = ( page ) =>
	page.addInitScript( ( gpu ) => {
		if ( gpu ) {
			Object.defineProperty( Navigator.prototype, 'gpu', {
				get: () => undefined,
			} );
			return;
		}
		const get = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function ( type, ...rest ) {
			return type === 'webgl2' ? null : get.call( this, type, ...rest );
		};
	}, GPU );

/**
 * The browser takes away what the canvas of the slider draws with.
 *
 * @param {import('@playwright/test').Page} page Page.
 */
export const lose = ( page ) =>
	page.evaluate( ( gpu ) => {
		if ( gpu ) {
			window.devices.forEach( ( device ) => device.destroy() );
			return;
		}
		window.slider.plugins.gl.canvas
			.getContext( 'webgl2' )
			.getExtension( 'WEBGL_lose_context' )
			.loseContext();
	}, GPU );

/**
 * Opens the test page.
 *
 * @param {import('@playwright/test').Page} page    Page.
 * @param {Object}                          [setup] `n`, `o` (options), `css`,
 *                                                  `dir`, `plugins`, `effects`.
 */
export async function open( page, setup = {} ) {
	const query = new URLSearchParams();
	for ( const [ key, value ] of Object.entries( setup ) ) {
		query.set( key, key === 'o' ? JSON.stringify( value ) : String( value ) );
	}
	// FROM=dist tests what is built.
	if ( process.env.FROM ) {
		query.set( 'from', process.env.FROM );
	}
	// LAYER=gpu tests the canvas of WebGPU.
	if ( process.env.LAYER && ! setup.layer ) {
		query.set( 'layer', process.env.LAYER );
	}
	// Counts the frames the page asks for, and keeps the devices it gets.
	await page.addInitScript( () => {
		window.devices = [];
		const device = window.GPUAdapter?.prototype.requestDevice;
		if ( device ) {
			window.GPUAdapter.prototype.requestDevice = async function ( ...all ) {
				const made = await device.apply( this, all );
				window.devices.push( made );
				return made;
			};
		}
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
				slide.querySelector( '.gs-media.gs-drawn' )
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
		.waitForFunction( () => !! window.slider.plugins.gl?.canvas, null, {
			// The layer hears that it is on the screen a moment after it
			// was made.
			timeout: 2000,
		} )
		.then(
			() => true,
			() => false
		);
