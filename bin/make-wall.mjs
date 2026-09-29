/**
 * Generates the pictures of the wall into `demo/wall/media/`, and the rows
 * of `demo/wall/index.html`: nothing is downloaded.
 *
 * Each picture is a page rendered by Chromium: a scene of gradients, noise
 * and shapes, with its title on it. The title is in the picture because
 * the glass of the wall bends what it shows, and what is written on the
 * page would not bend with it.
 *
 * `node bin/make-wall.mjs`
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const wall = resolve( fileURLToPath( import.meta.url ), '../../demo/wall' );
mkdirSync( resolve( wall, 'media' ), { recursive: true } );

const W = 840;
const H = 560;
const ROWS = 7;
const IN_A_ROW = 8;

const TITLES = [
	[ 'Quiet Engine', 'Work that runs without being heard.' ],
	[ 'Salt Hour', 'The coast, an hour before anyone is up.' ],
	[ 'Paper Weather', 'Forecasts, folded and kept.' ],
	[ 'Low Orbit', 'Close enough to see the roads.' ],
	[ 'Second Light', 'What a room looks like the next day.' ],
	[ 'Glass Season', 'Four months of looking through things.' ],
	[ 'Slow Signal', 'A message that takes its time.' ],
	[ 'Open Water', 'No lanes, no walls, no floor.' ],
	[ 'Warm Static', 'The sound between two stations.' ],
	[ 'Blue Margin', 'Notes from the edge of the page.' ],
	[ 'Long Shadow', 'Late in the day, everything is tall.' ],
	[ 'First Draft', 'Before anyone said what it was.' ],
	[ 'Tidal Room', 'A space that fills and empties.' ],
	[ 'Dry Thunder', 'All of the noise, none of the rain.' ],
	[ 'Far Field', 'Measured from a long way off.' ],
	[ 'Still Moving', 'A study of things that do not stop.' ],
	[ 'Bright Dust', 'What the light finds in the air.' ],
	[ 'Half Light', 'Neither the day nor the night.' ],
	[ 'Cold Open', 'It starts before the title.' ],
	[ 'Inner Coast', 'A shoreline that is on no map.' ],
	[ 'Lost Format', 'Made for a machine that is gone.' ],
	[ 'Odd Hours', 'Open when nothing else is.' ],
	[ 'Rough Cut', 'Everything is still in it.' ],
	[ 'Thin Air', 'Higher than is good for you.' ],
];
const KINDS = [ 'Film', 'Field', 'Sound', 'Print', 'Light', 'Space' ];

const PALETTES = [
	[ '#ff5f6d', '#ffc371', '#2b1055' ],
	[ '#00c6ff', '#0072ff', '#070b24' ],
	[ '#a8ff78', '#1de9b6', '#03282a' ],
	[ '#f953c6', '#7b2ff7', '#14031f' ],
	[ '#fdc830', '#f37335', '#240a02' ],
	[ '#c471ed', '#12c2e9', '#080d2c' ],
	[ '#f6f1e7', '#9fb8c8', '#1c2a38' ],
	[ '#ee9ca7', '#ff6a88', '#2a0f1c' ],
];

// A number that follows from another, between 0 and 1.
const chance = ( n, k ) => {
	const x = Math.sin( n * 127.1 + k * 311.7 ) * 43758.5453;
	return x - Math.floor( x );
};

const SCENES = [
	// Lights in the dark.
	( [ a, b, c ], n ) => `
		<div style="position:absolute;inset:0;background:
			radial-gradient( 70% 90% at ${ 10 + chance( n, 1 ) * 50 }% 10%, ${ a } 0, transparent 65% ),
			radial-gradient( 80% 80% at ${ 90 - chance( n, 2 ) * 40 }% 95%, ${ b } 0, transparent 70% ),
			${ c }"></div>
		<div style="position:absolute;inset:-20%;filter:blur(50px);background:
			radial-gradient( 25% 35% at ${ 30 + chance( n, 3 ) * 40 }% 50%, #fff9 0, transparent 70% )"></div>`,
	// A sun over lines.
	( [ a, b, c ], n ) => `
		<div style="position:absolute;inset:0;background:linear-gradient( ${ c } 0, ${ b } 55%, ${ a } 78%, ${ c } 78% )"></div>
		<div style="position:absolute;left:${ 38 + chance( n, 1 ) * 30 }%;top:20%;width:${ H * 0.62 }px;height:${ H * 0.62 }px;border-radius:50%;
			background:linear-gradient( #fff, ${ a } 70% );
			-webkit-mask:repeating-linear-gradient( #000 0 22px, transparent 22px 30px ),linear-gradient( #000 0 55%, transparent 55% );
			-webkit-mask-composite:source-over"></div>
		<div style="position:absolute;inset:78% 0 0;background:
			repeating-linear-gradient( 90deg, #fff5 0 2px, transparent 2px 70px ),
			repeating-linear-gradient( 0deg, #fff5 0 2px, transparent 2px 34px ), ${ c };
			transform:perspective( 300px ) rotateX( 55deg );transform-origin:50% 0"></div>`,
	// Rings.
	( [ a, b, c ], n ) => `
		<div style="position:absolute;inset:0;background:
			repeating-radial-gradient( circle at ${ 20 + chance( n, 1 ) * 60 }% ${ 25 + chance( n, 2 ) * 40 }%, ${ a } 0 14px, ${ c } 14px 30px, ${ b } 30px 38px, ${ c } 38px 64px )"></div>
		<div style="position:absolute;inset:0;background:linear-gradient( 120deg, transparent 30%, ${ c }cc 90% )"></div>`,
	// Clouds.
	( [ a, b, c ], n ) => `
		<svg width="${ W }" height="${ H }" style="position:absolute;inset:0">
			<filter id="f" x="0" y="0" width="100%" height="100%">
				<feTurbulence type="fractalNoise" baseFrequency="${ 0.004 + chance( n, 1 ) * 0.004 } 0.012" numOctaves="5" seed="${ n }"/>
				<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -1.05"/>
			</filter>
			<rect width="100%" height="100%" fill="${ b }"/>
			<rect width="100%" height="100%" fill="url(#g)"/>
			<linearGradient id="g" x2="0" y2="1"><stop stop-color="${ c }"/><stop offset="1" stop-color="${ a }" stop-opacity="0.6"/></linearGradient>
			<rect width="100%" height="100%" filter="url(#f)"/>
		</svg>`,
	// Dunes.
	( [ a, b, c ], n ) => {
		let paths = '';
		for ( let i = 0; i < 6; i++ ) {
			const y = H * ( 0.3 + i * 0.12 );
			const bow = 30 + chance( n, i ) * 60;
			const lean = chance( n, i + 9 ) * W;
			paths += `<path d="M0 ${ y } C ${ lean * 0.5 } ${ y - bow }, ${ lean } ${ y + bow }, ${ W } ${ y - bow * 0.4 } V ${ H } H 0 Z"
				fill="${ i % 2 ? a : b }" opacity="${ 0.25 + i * 0.12 }"/>`;
		}
		return `<svg width="${ W }" height="${ H }" style="position:absolute;inset:0;background:linear-gradient( ${ c }, ${ b } )">
			<circle cx="${ W * ( 0.2 + chance( n, 20 ) * 0.6 ) }" cy="${ H * 0.26 }" r="${ H * 0.11 }" fill="#fff" opacity="0.9"/>
			${ paths }</svg>`;
	},
	// A town at night, from above.
	( [ a, b, c ], n ) => `
		<svg width="${ W }" height="${ H }" style="position:absolute;inset:0;background:${ c }">
			<filter id="f" x="0" y="0" width="100%" height="100%">
				<feTurbulence type="turbulence" baseFrequency="0.035 0.05" numOctaves="3" seed="${ n }"/>
				<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -9 0 0 0 2.2"/>
			</filter>
			<pattern id="p" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(${ 20 + chance( n, 1 ) * 40 })">
				<circle cx="3" cy="3" r="1.4" fill="${ a }"/><circle cx="7" cy="7" r="1" fill="${ b }"/>
			</pattern>
			<mask id="m"><rect width="100%" height="100%" filter="url(#f)"/></mask>
			<rect width="100%" height="100%" fill="url(#p)" mask="url(#m)"/>
			<rect width="100%" height="100%" fill="${ a }" opacity="0.12"/>
		</svg>`,
];

const page = ( i ) => {
	const [ title, line ] = TITLES[ i ];
	const colors = PALETTES[ ( i * 3 ) % PALETTES.length ];
	const number = String( i + 1 ).padStart( 2, '0' );
	return `<!doctype html>
<style>
	html, body { margin: 0; }
	body {
		width: ${ W }px; height: ${ H }px; overflow: hidden; position: relative;
		background: ${ colors[ 2 ] }; color: #fff;
		font: 600 68px/1 "Helvetica Neue", Helvetica, Arial, sans-serif;
	}
	.shade { position: absolute; inset: 0; background: linear-gradient( transparent 35%, #000a ); }
	.grain { position: absolute; inset: 0; opacity: 0.16; mix-blend-mode: overlay; }
	.top, .line { position: absolute; font: 500 12px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.85; }
	.top { inset: 62px 84px auto; display: flex; justify-content: space-between; }
	.rule { position: absolute; inset: 58% 84px auto; border-top: 1px solid #fff9; }
	h1 { position: absolute; left: 82px; top: 63%; margin: 0; font: inherit; letter-spacing: -0.035em; text-shadow: 0 2px 30px #0007; }
	.line { left: 84px; bottom: 78px; text-transform: none; letter-spacing: 0.02em; font: 400 15px/1 "Helvetica Neue", Helvetica, Arial, sans-serif; }
</style>
${ SCENES[ i % SCENES.length ]( colors, i + 1 ) }
<div class="shade"></div>
<svg class="grain" width="${ W }" height="${ H }"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${ i }"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="top"><span>N° ${ number } · ${ KINDS[ i % KINDS.length ] }</span><span>Selected · 2026</span></div>
<div class="rule"></div>
<h1>${ title }</h1>
<div class="line">${ line }</div>`;
};

const browser = await chromium.launch();
const tab = await browser.newPage( { viewport: { width: W, height: H } } );
for ( let i = 0; i < TITLES.length; i++ ) {
	await tab.setContent( page( i ) );
	await tab.screenshot( {
		path: resolve( wall, `media/${ String( i + 1 ).padStart( 2, '0' ) }.jpg` ),
		type: 'jpeg',
		quality: 80,
	} );
}
await browser.close();

// The rows of the page, between its two marks.
let rows = '';
for ( let row = 0; row < ROWS; row++ ) {
	rows += `\t\t<div class="ss-slide">\n\t\t\t<div class="ss row" aria-label="Row ${ row + 1 } of ${ ROWS }">\n\t\t\t\t<div class="ss-track">\n`;
	for ( let i = 0; i < IN_A_ROW; i++ ) {
		// No picture twice in a row.
		const n = ( row * 7 + i * [ 5, 7, 11, 13, 17, 19, 23 ][ row ] ) % TITLES.length;
		const [ title, line ] = TITLES[ n ];
		rows += `\t\t\t\t\t<div class="ss-slide"><img class="ss-media" src="media/${ String(
			n + 1
		).padStart( 2, '0' ) }.jpg" width="${ W }" height="${ H }" alt="${ title }. ${ line }"></div>\n`;
	}
	rows += '\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n';
}
const file = resolve( wall, 'index.html' );
const html = readFileSync( file, 'utf8' );
writeFileSync(
	file,
	html.replace(
		/(<!-- rows -->\n)[^]*?(\t\t<!-- \/rows -->)/,
		( all, from, to ) => from + rows + to
	)
);
