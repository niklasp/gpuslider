/**
 * Makes the film of the site of a video that is given: `media/film.mp4`,
 * a loop without a seam, and its poster.
 *
 * The film is a video of Pexels (13794727, 1280 by 720, 15 s), which is
 * not in the repo. Its end does not meet its start, so the loop is between
 * the two moments of it that are most alike, 6.6 s and 14.2 s, and what
 * comes after the second fades into what comes after the first.
 *
 * `node bin/make-film.mjs ~/Downloads/13794727_1280_720_30fps.mp4`
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve( fileURLToPath( import.meta.url ), '../../media' );
const [ source ] = process.argv.slice( 2 );
if ( ! source ) {
	throw new Error( 'Which video? node bin/make-film.mjs <file>' );
}

// Where the loop begins and ends in the video, and how long the fade is.
const FROM = 6.6;
const TO = 14.2;
const FADE = 0.6;

const film = resolve( out, 'film.mp4' );
execFileSync(
	'ffmpeg',
	[
		'-y',
		'-i',
		source,
		'-filter_complex',
		[
			`[0:v]trim=start=${ FROM + FADE }:end=${ TO + FADE },setpts=PTS-STARTPTS,fps=30[main]`,
			`[0:v]trim=start=${ FROM }:end=${ FROM + FADE },setpts=PTS-STARTPTS,fps=30[head]`,
			`[main][head]xfade=transition=fade:duration=${ FADE }:offset=${ TO - FROM - FADE },scale=960:540:flags=lanczos,format=yuv420p[out]`,
		].join( ';' ),
		'-map',
		'[out]',
		'-c:v',
		'libx264',
		'-preset',
		'veryslow',
		'-crf',
		'31',
		'-movflags',
		'+faststart',
		'-an',
		film,
	],
	{ stdio: 'pipe' }
);

const frame = resolve( out, 'film-poster.png' );
const poster = resolve( out, 'film-poster.avif' );
execFileSync( 'ffmpeg', [ '-y', '-i', film, '-frames:v', '1', frame ], {
	stdio: 'pipe',
} );
await sharp( frame ).avif( { quality: 50, effort: 6 } ).toFile( poster );
rmSync( frame );

const kb = ( file ) => `${ Math.round( statSync( file ).size / 1024 ) } KB`;
// eslint-disable-next-line no-console
console.log( `film.mp4: ${ kb( film ) }, poster: ${ kb( poster ) }` );
