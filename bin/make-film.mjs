/**
 * Makes a film of the site of a video that is given: `media/<name>.mp4`,
 * a loop without a seam, and its poster.
 *
 * The films are videos of Pexels, which are not in the repo. Their end
 * does not meet their start, so the loop is between the two moments of
 * them that are most alike, and what comes after the second fades into
 * what comes after the first.
 *
 *     node bin/make-film.mjs ~/Downloads/13794727_1280_720_30fps.mp4
 *     node bin/make-film.mjs 12417619_1920_1080_30fps.mp4 concert 18.7 27.2
 *     node bin/make-film.mjs 6836033-hd_1920_1080_25fps.mp4 dance 12 19.6
 *
 * `film` is 13794727 (1280 by 720, 15 s): someone walking into a tunnel of
 * coloured lights, 6.6 s to 14.2 s. `concert` is 28551470 (1920 by 1080,
 * 33 s), a crowd before a stage in blue light. `dance` is 6836033 (1920 by
 * 1080, 24 s), a dancer with tubes of light.
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve( fileURLToPath( import.meta.url ), '../../media' );
const [ source, name = 'film', from = '6.6', to = '14.2' ] =
	process.argv.slice( 2 );
if ( ! source ) {
	throw new Error( 'Which video? node bin/make-film.mjs <file> [name from to]' );
}

// Where the loop begins and ends in the video, and how long the fade is.
const FROM = Number( from );
const TO = Number( to );
const FADE = 0.6;

const film = resolve( out, `${ name }.mp4` );
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

const frame = resolve( out, `${ name }-poster.png` );
const poster = resolve( out, `${ name }-poster.avif` );
execFileSync( 'ffmpeg', [ '-y', '-i', film, '-frames:v', '1', frame ], {
	stdio: 'pipe',
} );
await sharp( frame ).avif( { quality: 50, effort: 6 } ).toFile( poster );
rmSync( frame );

const kb = ( file ) => `${ Math.round( statSync( file ).size / 1024 ) } KB`;
// eslint-disable-next-line no-console
console.log( `${ name }.mp4: ${ kb( film ) }, poster: ${ kb( poster ) }` );
