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
		// Read on a busy machine too: four tests draw at once.
		await expect( list.locator( 'li' ) ).toHaveCount( 3, { timeout: 15000 } );
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

	/** Whether the browser can encode H.264; skips the test where not. */
	const encoder = async ( page ) => {
		const can = await page.evaluate( async () =>
			'VideoEncoder' in window &&
			( await VideoEncoder.isConfigSupported( { codec: 'avc1.4d0028', width: 1080, height: 1920, framerate: 30, bitrate: 8e6, avc: { format: 'avc' } } ) ).supported
		);
		test.skip( ! can, 'This browser has no H.264 encoder (WebCodecs).' );
	};

	/** Two photos, a short film: 0.2 s on each, transitions of 0.4 s. */
	const short = async ( page ) => {
		await page.getByTestId( 'photos' ).setInputFiles( [ media( 'p1.jpg' ), media( 'p3.jpg' ) ] );
		await expect( page.getByText( '2 of 20' ) ).toBeVisible();
		await page.getByRole( 'slider', { name: 'Transition' } ).fill( '0.4' );
		await page.getByRole( 'slider', { name: 'Time on each photo' } ).fill( '0.2' );
	};

	/** Exports, and gives the file. */
	const exported = async ( page ) => {
		const download = page.waitForEvent( 'download', { timeout: 90000 } );
		await page.getByRole( 'button', { name: /Export MP4/ } ).click();
		const file = await download;
		if ( process.env.STUDIO_OUT ) {
			await file.saveAs( process.env.STUDIO_OUT );
		}
		return file;
	};

	test( 'a film of two photos is exported as an MP4, without a loop', async ( { page } ) => {
		await page.goto( '/studio/' );
		await encoder( page );
		await short( page );
		await page.getByRole( 'switch', { name: /Loop/ } ).click();
		await expect( page.getByRole( 'switch', { name: /Loop/ } ) ).toHaveAttribute( 'aria-checked', 'false' );
		// 0.2 + 0.4 + 0.2 s: it ends on the last photo.
		await expect( page.getByText( '0.8 s in all' ) ).toBeVisible();
		await expect( page.getByTestId( 'duration' ) ).toHaveText( '0.8 s' );
		const file = await exported( page );
		expect( file.suggestedFilename() ).toBe( 'slideshow-9x16.mp4' );
		const bytes = await ( await file.createReadStream() ).toArray().then( ( parts ) => Buffer.concat( parts ) );
		expect( bytes.length ).toBeGreaterThan( 10000 );
		expect( bytes.subarray( 4, 8 ).toString() ).toBe( 'ftyp' );
		expect( bytes.includes( Buffer.from( 'avcC' ) ) ).toBe( true );
		await expect( page.getByText( /^Done: 0\.8 s/ ) ).toBeVisible();
	} );

	test( 'a film that loops ends one frame before it begins', async ( { page } ) => {
		await page.goto( '/studio/' );
		await encoder( page );
		await short( page );
		await page.getByRole( 'button', { name: 'Liquid', exact: true } ).click();
		// Looped by default: 2 × ( 0.2 + 0.4 ) s.
		await expect( page.getByRole( 'switch', { name: /Loop/ } ) ).toHaveAttribute( 'aria-checked', 'true' );
		await expect( page.getByTestId( 'duration' ) ).toHaveText( '1.2 s' );
		await expect( page.getByText( '1.2 s in all' ) ).toBeVisible();
		expect( ( await exported( page ) ).suggestedFilename() ).toBe( 'slideshow-9x16-loop.mp4' );
		const href = await page.getByTestId( 'download' ).getAttribute( 'href' );
		// The film decoded again, frame by frame, and how far each frame is
		// from the one before it: the mean difference of a colour, 0 to 255.
		const film = await page.evaluate( async ( address ) => {
			const data = new DataView( await ( await fetch( address ) ).arrayBuffer() );
			const type = ( at ) => String.fromCharCode( ...[ 0, 1, 2, 3 ].map( ( i ) => data.getUint8( at + 4 + i ) ) );
			const found = {};
			const walk = ( from, to ) => {
				for ( let at = from; at < to; at += data.getUint32( at ) ) {
					const name = type( at );
					const end = at + data.getUint32( at );
					found[ name ] = at + 8;
					if ( [ 'moov', 'trak', 'mdia', 'minf', 'stbl' ].includes( name ) ) {
						walk( at + 8, end );
					} else if ( name === 'stsd' ) {
						// avc1 after the count, its boxes after its 78 bytes.
						walk( at + 16 + 8 + 78, at + 16 + data.getUint32( at + 16 ) );
					}
				}
			};
			walk( 0, data.byteLength );
			const count = data.getUint32( found.stsz + 8 );
			const sizes = Array.from( { length: count }, ( _, i ) => data.getUint32( found.stsz + 12 + i * 4 ) );
			const keys = found.stss
				? new Set( Array.from( { length: data.getUint32( found.stss + 4 ) }, ( _, i ) => data.getUint32( found.stss + 8 + i * 4 ) - 1 ) )
				: null;
			let offset = data.getUint32( found.stco + 8 );
			const avcc = new Uint8Array( data.buffer, found.avcC, data.getUint32( found.avcC - 8 ) - 8 );
			const codec = `avc1.${ [ ...avcc.subarray( 1, 4 ) ].map( ( n ) => n.toString( 16 ).padStart( 2, '0' ) ).join( '' ) }`;
			const canvas = new OffscreenCanvas( 108, 192 );
			const context = canvas.getContext( '2d', { willReadFrequently: true } );
			const frames = [];
			const decoder = new VideoDecoder( {
				output( frame ) {
					context.drawImage( frame, 0, 0, 108, 192 );
					frames.push( context.getImageData( 0, 0, 108, 192 ).data );
					frame.close();
				},
				error() {},
			} );
			decoder.configure( { codec, description: avcc, codedWidth: 1080, codedHeight: 1920 } );
			sizes.forEach( ( size, i ) => {
				decoder.decode(
					new EncodedVideoChunk( {
						type: ! keys || keys.has( i ) ? 'key' : 'delta',
						timestamp: i,
						data: new Uint8Array( data.buffer, offset, size ),
					} )
				);
				offset += size;
			} );
			await decoder.flush();
			const away = ( a, b ) => {
				let sum = 0;
				for ( let i = 0; i < a.length; i++ ) {
					if ( i % 4 !== 3 ) {
						sum += Math.abs( a[ i ] - b[ i ] );
					}
				}
				return sum / ( ( a.length / 4 ) * 3 );
			};
			const steps = frames.map( ( frame, i ) => away( frame, frames[ ( i + frames.length - 1 ) % frames.length ] ) );
			return { count, decoded: frames.length, steps };
		}, href );
		expect( film.count ).toBe( Math.round( 1.2 * 30 ) );
		expect( film.decoded ).toBe( film.count );
		// steps[ i ]: frame i against the one before; steps[ 0 ], the first
		// against the last, is the wrap. Frames 0 to 5 are the first photo
		// held, 18 to 23 the second.
		const hold = Math.max( ...[ 1, 2, 3, 4, 5, 19, 20, 21, 22, 23 ].map( ( i ) => film.steps[ i ] ) );
		const turning = Math.max( ...film.steps.slice( 6, 18 ) );
		// The same moment in the film: the last frame of the transition
		// into the second photo, then that photo held.
		const landing = film.steps[ 18 ];
		const wrap = film.steps[ 0 ];
		console.log( `wrap ${ wrap.toFixed( 3 ) }, landing ${ landing.toFixed( 3 ) }, held ${ hold.toFixed( 3 ) }, turning ${ turning.toFixed( 3 ) }` );
		// As small as a step between frames that are held, near enough: a
		// key frame, and what is left of the transition one frame before
		// its end. And no larger than where a transition ends in the film.
		expect( wrap ).toBeLessThan( 3 * hold );
		expect( wrap ).toBeLessThan( 2 * landing + hold );
		expect( wrap ).toBeLessThan( turning / 10 );
	} );
} );
