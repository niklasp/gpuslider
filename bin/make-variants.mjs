/**
 * Makes of every image in `media/` what a page should send: AVIF, in
 * the widths of `WIDTHS`, for `srcset`. And of every video its first frame,
 * as a poster.
 *
 *     1.jpg  →  1-480.avif, 1-720.avif, 1-960.avif, 1-1600.avif
 *     a.mp4  →  a-poster.avif
 *
 * The JPEGs stay: the tests compare pixels with them.
 *
 * `node bin/make-variants.mjs`
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve( fileURLToPath( import.meta.url ), '../../media' );

export const WIDTHS = [ 480, 720, 960, 1600 ];

const kb = ( file ) => `${ Math.round( statSync( file ).size / 1024 ) } KB`;

for ( const file of readdirSync( out ).sort() ) {
	const [ , name, kind ] = file.match( /^([a-z0-9]+)\.(jpg|mp4)$/ ) || [];
	if ( kind === 'jpg' ) {
		const image = sharp( resolve( out, file ) );
		const { width } = await image.metadata();
		const made = [];
		for ( const w of WIDTHS ) {
			const to = resolve( out, `${ name }-${ w }.avif` );
			await image
				.clone()
				.resize( { width: Math.min( w, width ) } )
				.avif( { quality: 55, effort: 6 } )
				.toFile( to );
			made.push( `${ w }: ${ kb( to ) }` );
		}
		// eslint-disable-next-line no-console
		console.log( `${ file } (${ kb( resolve( out, file ) ) })  →  ${ made.join( ', ' ) }` );
	}
	if ( kind === 'mp4' ) {
		const frame = resolve( out, `${ name }-poster.png` );
		const to = resolve( out, `${ name }-poster.avif` );
		try {
			execFileSync(
				'ffmpeg',
				[ '-y', '-i', resolve( out, file ), '-frames:v', '1', frame ],
				{ stdio: 'pipe' }
			);
			await sharp( frame ).avif( { quality: 50, effort: 6 } ).toFile( to );
			rmSync( frame );
			// eslint-disable-next-line no-console
			console.log( `${ file }  →  poster: ${ kb( to ) }` );
		} catch {
			// eslint-disable-next-line no-console
			console.warn( `No poster for ${ file }: ffmpeg failed or is missing.` );
		}
	}
}
