/**
 * Measures the two canvas layers against each other, with the same GPU,
 * in the browsers that have both.
 *
 * `node bin/bench.mjs [--headed] [--dist] [--runs=5] [--write]`
 *
 * `--write` writes what was found to `site/src/lib/bench.json`: the site
 * says the numbers, with the machine and the day they are of.
 *
 * What is measured, and what is not: see `bench/bench.js`. A browser
 * without a window draws, but shows nothing to a screen: `--headed` is
 * nearer to what a visitor has.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { chromium, webkit } from '@playwright/test';

const args = process.argv.slice( 2 );
const headed = args.includes( '--headed' );
const dist = args.includes( '--dist' );
const write = args.includes( '--write' );
const runs = Number( args.find( ( arg ) => arg.startsWith( '--runs=' ) )?.slice( 7 ) ) || 5;
const port = 4176;

const BROWSERS = {
	'Chromium (Metal)': () =>
		chromium.launch( {
			headless: ! headed,
			args: [ '--enable-unsafe-webgpu', '--use-angle=metal' ],
		} ),
	WebKit: () => webkit.launch( { headless: ! headed } ),
};
const LAYERS = { gl: 'WebGL', gpu: 'WebGPU' };
const LOADS = [
	[ 1, '' ],
	[ 6, '' ],
	[ 20, '' ],
	[ 1, 'stretch,waves' ],
	[ 6, 'stretch,waves' ],
	[ 20, 'stretch,waves' ],
];

const middle = ( numbers ) =>
	[ ...numbers ].sort( ( a, b ) => a - b )[ Math.floor( numbers.length / 2 ) ];
const ms = ( number ) => number.toFixed( number < 10 ? 2 : 1 );

const server = spawn( 'node', [ 'bin/serve.mjs', String( port ) ], {
	stdio: 'ignore',
} );
await new Promise( ( done ) => setTimeout( done, 500 ) );

/**
 * One page in a browser of its own: nothing is kept from the run before.
 *
 * @param {Function} launch  Launches the browser.
 * @param {Object}   setup   What the page is asked for.
 * @param {boolean}  measure Whether the sliders are measured while they
 *                           move.
 * @return {Promise<Object>} What the page found.
 */
async function run( launch, setup, measure ) {
	const browser = await launch();
	const page = await browser.newPage( {
		viewport: { width: 1300, height: 800 },
		deviceScaleFactor: 2,
	} );
	const said = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' ) {
			said.push( message.text() );
		}
	} );
	const query = new URLSearchParams( {
		...setup,
		wait: 1,
		...( dist ? { from: 'dist' } : {} ),
	} );
	await page.goto( `http://localhost:${ port }/bench/?${ query }` );
	await page.waitForFunction( () => window.ready, null, { timeout: 60000 } );
	const result = await page.evaluate( () => window.result );
	if ( measure ) {
		await page.waitForTimeout( 1000 );
		// What the processes of the browser work meanwhile: Chromium says.
		const cdp = await browser.newBrowserCDPSession?.().catch( () => null );
		const work = async () =>
			cdp
				? ( await cdp.send( 'SystemInfo.getProcessInfo' ) ).processInfo
				: [];
		const before = await work();
		const began = Date.now();
		result.run = await page.evaluate( () => window.measure() );
		const time = ( Date.now() - began ) / 1000;
		for ( const { id, type, cpuTime } of await work() ) {
			const was = before.find( ( process ) => process.id === id );
			const kind = type.toLowerCase();
			if ( was && [ 'renderer', 'gpu' ].includes( kind ) ) {
				result.run[ kind ] =
					( result.run[ kind ] || 0 ) +
					( ( cpuTime - was.cpuTime ) / time ) * 100;
			}
		}
	}
	result.said = said;
	await browser.close();
	return result;
}

const out = [];
// The same as numbers, for the site.
const written = {
	date: new Date().toISOString().slice( 0, 10 ),
	machine: cpus()[ 0 ].model,
	density: 2,
	window: headed,
	runs,
	browsers: [],
};
const say = ( line = '' ) => {
	out.push( line );
	// eslint-disable-next-line no-console
	console.log( line );
};

process.on( 'exit', () => server.kill() );

for ( const [ browser, launch ] of Object.entries( BROWSERS ) ) {
	const one = await launch();
	say( `### ${ browser } ${ one.version() }${ headed ? '' : ', without a window' }` );
	const numbers = {
		name: browser,
		version: one.version(),
		until: [],
		moving: [],
	};
	written.browsers.push( numbers );
	await one.close();
	say();
	say( `Until a slider is drawn, ms (the middle of ${ runs } runs, each in a browser that has drawn nothing before)` );
	say();
	say( '| Effects | | The first slider of the page | One made after it |' );
	say( '| --- | --- | --- | --- |' );
	for ( const effects of [ '', 'stretch,waves' ] ) {
		const found = { gl: [], gpu: [] };
		// In turns, so that nothing is warm for the one and not the other.
		for ( let i = 0; i < runs; i++ ) {
			for ( const layer in LAYERS ) {
				found[ layer ].push( await run( launch, { layer, n: 2, effects } ) );
			}
		}
		for ( const layer in LAYERS ) {
			const errors = found[ layer ].flatMap( ( result ) => result.said );
			numbers.until.push( {
				effects,
				layer,
				first: middle( found[ layer ].map( ( result ) => result.first.shown ) ),
				second: middle(
					found[ layer ].map( ( result ) => result.second.shown )
				),
			} );
			say(
				`| ${ effects || 'none' } | ${ LAYERS[ layer ] } | ${ ms(
					middle( found[ layer ].map( ( result ) => result.first.shown ) )
				) } | ${ ms(
					middle( found[ layer ].map( ( result ) => result.second.shown ) )
				) } |${ errors.length ? ` ${ errors[ 0 ] }` : '' }`
			);
		}
	}
	say();
	say( 'While all sliders move, 4 s' );
	say();
	say( '| Sliders | Effects | | Drawn by the canvas | The ones after the second, made together: drawn after, ms | Script in a frame, ms | 19 of 20 under | From frame to frame, ms | 19 of 20 under | Late frames | Work of the page | Work of the GPU process |' );
	say( '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |' );
	for ( const [ n, effects ] of LOADS ) {
		for ( const layer in LAYERS ) {
			const { run: found, said, canvases, rest } = await run(
				launch,
				{ layer, n, effects },
				true
			);
			const share = ( value ) =>
				value === undefined ? 'not told' : `${ value.toFixed( 0 ) } %`;
			numbers.moving.push( {
				sliders: n,
				effects,
				layer,
				canvases,
				rest: n > 2 ? rest : undefined,
				...found,
			} );
			say(
				`| ${ n } | ${ effects || 'none' } | ${ LAYERS[ layer ] } | ${ canvases } | ${
					n > 2 ? ms( rest ) : ''
				} | ${ ms( found.script ) } | ${ ms(
					found.script95
				) } | ${ ms( found.apart ) } | ${ ms( found.apart95 ) } | ${ found.late } of ${
					found.frames
				} | ${ share( found.renderer ) } | ${ share( found.gpu ) } |${
					said.length ? ` ${ said[ 0 ] }` : ''
				}`
			);
		}
	}
	say();
}

if ( write ) {
	const round = ( key, value ) =>
		typeof value === 'number' ? Math.round( value * 100 ) / 100 : value;
	writeFileSync(
		'site/src/lib/bench.json',
		JSON.stringify( written, round, '\t' ) + '\n'
	);
}

process.exit();
