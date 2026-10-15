/**
 * The Studio: photos in, a film out, made in the browser.
 */
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const media = ( name ) => fileURLToPath( new URL( `../public/media/${ name }`, import.meta.url ) );

/** What the console of a page said that should not be said. */
const errors = ( page ) => {
	const said = [];
	page.on( 'console', ( message ) => message.type() === 'error' && said.push( message.text() ) );
	page.on( 'pageerror', ( error ) => said.push( error.message ) );
	return said;
};

test.describe( 'the studio', () => {
	test.slow();

	test( 'is a page, and draws the sample photos', async ( { page } ) => {
		const said = errors( page );
		await page.goto( '/studio/' );
		await expect( page.locator( 'h1' ) ).toHaveText( 'Photo slideshow maker with shader transitions' );
		await expect( page.getByText( 'Your photos never leave your browser' ) ).toBeVisible();
		await expect( page.getByText( 'Sample photos', { exact: true } ) ).toBeVisible( { timeout: 15000 } );
		// Twenty-four transitions, and the mix.
		await expect( page.getByRole( 'group', { name: 'Transition' } ).getByRole( 'button' ) ).toHaveCount( 25 );
		// The preview draws: there is something in its canvas.
		await expect
			.poll(
				() =>
					page.locator( 'canvas[aria-label="Preview of the film"]' ).evaluate( ( canvas ) => {
						const copy = document.createElement( 'canvas' );
						copy.width = 16;
						copy.height = 16;
						const context = copy.getContext( '2d' );
						context.drawImage( canvas, 0, 0, 16, 16 );
						return context.getImageData( 0, 0, 16, 16 ).data.some( ( n, i ) => i % 4 !== 3 && n > 20 );
					} ),
				{ timeout: 15000 }
			)
			.toBe( true );
		expect( said ).toEqual( [] );
	} );

	test( 'photos are added, moved and taken out', async ( { page } ) => {
		await page.goto( '/studio/' );
		await page.getByTestId( 'photos' ).setInputFiles( [ media( 'p1.jpg' ), media( 'p3.jpg' ), media( 'p5.jpg' ) ] );
		const list = page.getByRole( 'list', { name: 'Photos in the order of the film' } );
		await expect( list.locator( 'li' ) ).toHaveCount( 3 );
		// The samples are gone with the first photos of the visitor.
		await expect( page.getByText( 'Sample photos', { exact: true } ) ).toHaveCount( 0 );
		await expect( list.locator( 'img' ).first() ).toHaveAttribute( 'alt', 'p1.jpg' );
		await page.getByRole( 'button', { name: 'Move p1.jpg later' } ).click();
		await expect( list.locator( 'img' ).nth( 1 ) ).toHaveAttribute( 'alt', 'p1.jpg' );
		await page.getByRole( 'button', { name: 'Remove p3.jpg' } ).click();
		await expect( list.locator( 'img' ) ).toHaveCount( 2 );
		await expect( page.getByText( '2 of 20' ) ).toBeVisible();
	} );

	test( 'a transition takes all of its time, not its first quarter', async ( { page } ) => {
		await page.goto( '/studio/' );
		// How much of the change from the first photo to the second is
		// done at a quarter, half and three quarters of the transition.
		const done = await page.evaluate( async () => {
			const { createStage } = await import( '/src/pages/studio/stage.ts' );
			const { read } = await import( '/src/pages/studio/photos.ts' );
			const photos = await Promise.all( [ read( '/media/p1.jpg', 'a' ), read( '/media/p9.jpg', 'b' ) ] );
			const canvas = document.createElement( 'canvas' );
			canvas.width = 90;
			canvas.height = 160;
			const stage = createStage( canvas, { preserve: true } );
			// Push: it moves the whole picture, so the change is its progress.
			const plan = { count: 2, hold: 0, turn: 1.5, choice: 14, order: [] };
			const pixels = async ( t ) => {
				while ( ! stage.draw( photos, plan, t ) ) {
					await new Promise( ( r ) => setTimeout( r, 20 ) );
				}
				const out = new Uint8Array( 90 * 160 * 4 );
				const gl = canvas.getContext( 'webgl2' );
				gl.readPixels( 0, 0, 90, 160, gl.RGBA, gl.UNSIGNED_BYTE, out );
				return out;
			};
			const from = await pixels( 0 );
			const to = await pixels( 1.5 );
			const away = ( a, b ) => a.reduce( ( sum, n, i ) => sum + Math.abs( n - b[ i ] ), 0 );
			const all = away( from, to );
			const share = [];
			for ( const u of [ 0.25, 0.5, 0.75 ] ) {
				share.push( 1 - away( await pixels( u * 1.5 ), to ) / all );
			}
			stage.destroy( true );
			return share;
		} );
		test.info().annotations.push( { type: 'shares', description: done.map( ( n ) => n.toFixed( 2 ) ).join( ' ' ) } );
		console.log( 'done at 1/4, 1/2, 3/4:', done.map( ( n ) => n.toFixed( 2 ) ).join( ' ' ) );
		expect( done[ 0 ] ).toBeLessThan( 0.35 );
		expect( done[ 1 ] ).toBeGreaterThan( 0.2 );
		expect( done[ 1 ] ).toBeLessThan( 0.8 );
		expect( done[ 2 ] ).toBeGreaterThan( 0.65 );
	} );

	test( 'a film of two photos is exported as an MP4', async ( { page } ) => {
		await page.goto( '/studio/' );
		const can = await page.evaluate( async () =>
			'VideoEncoder' in window &&
			( await VideoEncoder.isConfigSupported( { codec: 'avc1.4d0028', width: 1080, height: 1920, framerate: 30, bitrate: 8e6, avc: { format: 'avc' } } ) ).supported
		);
		test.skip( ! can, 'This browser has no H.264 encoder (WebCodecs).' );
		await page.getByTestId( 'photos' ).setInputFiles( [ media( 'p1.jpg' ), media( 'p3.jpg' ) ] );
		await expect( page.getByText( '2 of 20' ) ).toBeVisible();
		// A short film: 0.2 + 0.4 + 0.2 s, 24 frames.
		await page.getByRole( 'slider', { name: 'Transition' } ).fill( '0.4' );
		await page.getByRole( 'slider', { name: 'Time on each photo' } ).fill( '0.2' );
		await expect( page.getByText( '0.8 s in all' ) ).toBeVisible();
		const download = page.waitForEvent( 'download', { timeout: 90000 } );
		await page.getByRole( 'button', { name: /Export MP4/ } ).click();
		const file = await download;
		if ( process.env.STUDIO_OUT ) {
			await file.saveAs( process.env.STUDIO_OUT );
		}
		expect( file.suggestedFilename() ).toBe( 'slideshow-9x16.mp4' );
		const bytes = await ( await file.createReadStream() ).toArray().then( ( parts ) => Buffer.concat( parts ) );
		expect( bytes.length ).toBeGreaterThan( 10000 );
		expect( bytes.subarray( 4, 8 ).toString() ).toBe( 'ftyp' );
		expect( bytes.includes( Buffer.from( 'avcC' ) ) ).toBe( true );
		await expect( page.getByText( /^Done: 0\.8 s/ ) ).toBeVisible();
	} );
} );
