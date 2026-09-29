/**
 * Generates the media of the site and the tests into `media/`: nothing is
 * downloaded.
 *
 * Each image is a page rendered by Chromium: soft colour fields with a fine
 * grid and a number on top. The grid is there on purpose, it shows what a
 * distortion does; the different formats are what auto height and auto
 * width need.
 *
 * The videos come from ffmpeg, when it is installed.
 *
 * `node bin/make-media.mjs`
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve( fileURLToPath( import.meta.url ), '../../media' );
mkdirSync( out, { recursive: true } );

const IMAGES = [
	{ w: 1600, h: 900, colors: [ '#ff5f6d', '#ffc371', '#2b1055' ] },
	{ w: 1600, h: 1200, colors: [ '#00c6ff', '#0072ff', '#0b0f2b' ] },
	{ w: 1200, h: 1600, colors: [ '#a8ff78', '#78ffd6', '#053b3a' ] },
	{ w: 1600, h: 900, colors: [ '#f953c6', '#b91d73', '#1a0521' ] },
	{ w: 1400, h: 1400, colors: [ '#fdc830', '#f37335', '#2a0c02' ] },
	{ w: 1600, h: 1000, colors: [ '#c471ed', '#12c2e9', '#0a1033' ] },
	{ w: 1600, h: 700, colors: [ '#56ab2f', '#a8e063', '#08230f' ] },
	{ w: 1200, h: 1500, colors: [ '#ee9ca7', '#ffdde1', '#3a1c25' ] },
];

const page = ( { w, h, colors: [ a, b, c ] }, n ) => `<!doctype html>
<style>
	html, body { margin: 0; }
	body {
		width: ${ w }px; height: ${ h }px; overflow: hidden; position: relative;
		background:
			radial-gradient( 60% 80% at ${ 15 + ( n * 23 ) % 60 }% 20%, ${ a } 0, transparent 70% ),
			radial-gradient( 70% 70% at ${ 85 - ( n * 17 ) % 50 }% 85%, ${ b } 0, transparent 70% ),
			${ c };
		font: 700 ${ Math.round( h * 0.5 ) }px/1 ui-sans-serif, system-ui, sans-serif;
	}
	.disc {
		position: absolute; border-radius: 50%;
		width: ${ h * 0.55 }px; height: ${ h * 0.55 }px;
		left: ${ 50 + ( n % 2 ? 12 : -32 ) }%; top: 18%;
		background: linear-gradient( 135deg, #fff8, #fff0 60% );
		box-shadow: 0 40px 120px #0006;
	}
	.grid {
		position: absolute; inset: 0;
		background:
			repeating-linear-gradient( 0deg, #fff3 0 2px, transparent 2px 80px ),
			repeating-linear-gradient( 90deg, #fff3 0 2px, transparent 2px 80px );
	}
	.n {
		position: absolute; left: 5%; bottom: 4%;
		color: #fff; text-shadow: 0 10px 60px #0008;
		letter-spacing: -0.04em;
	}
</style>
<div class="disc"></div>
<div class="grid"></div>
<div class="n">${ n }</div>`;

const browser = await chromium.launch();
const tab = await browser.newPage();
for ( const [ i, image ] of IMAGES.entries() ) {
	await tab.setViewportSize( { width: image.w, height: image.h } );
	await tab.setContent( page( image, i + 1 ) );
	await tab.screenshot( {
		path: resolve( out, `${ i + 1 }.jpg` ),
		type: 'jpeg',
		quality: 82,
	} );
}
await browser.close();

// Two short loops: moving colour fields with a grid.
const VIDEOS = [
	{ name: 'a', seed: 3, size: '1280x720' },
	{ name: 'b', seed: 11, size: '960x1200' },
];
try {
	for ( const { name, seed, size } of VIDEOS ) {
		execFileSync(
			'ffmpeg',
			[
				'-y',
				'-f',
				'lavfi',
				'-i',
				`gradients=s=${ size }:seed=${ seed }:speed=0.02:d=4:r=30`,
				'-vf',
				'drawgrid=w=80:h=80:t=2:c=white@0.2',
				'-c:v',
				'libx264',
				'-pix_fmt',
				'yuv420p',
				'-crf',
				'26',
				'-movflags',
				'+faststart',
				'-an',
				resolve( out, `${ name }.mp4` ),
			],
			{ stdio: 'pipe' }
		);
	}
} catch ( error ) {
	// eslint-disable-next-line no-console
	console.warn(
		'No videos: ffmpeg failed or is missing.',
		String( error.stderr || error.message ).split( '\n' ).slice( -4 ).join( '\n' )
	);
}
