/**
 * Asks Lighthouse what it makes of the pages of the site, as they are
 * built, and writes it to `site/src/lib/lighthouse.json`: the first page
 * says it.
 *
 * `node bin/lighthouse.mjs [/ /docs/ …]`
 *
 * Builds the site, serves the build, and asks for every page as a phone
 * on a slow connection and as a desktop. The browser is the Chromium of
 * the tests. What the first page says of itself is what was said of the
 * build before this one.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

// Another port when this one is taken: LIGHTHOUSE=5290.
const port = Number( process.env.LIGHTHOUSE ) || 5190;
const given = process.argv.slice( 2 );
const pages = given.length
	? given
	: [ '/', '/docs/', '/docs/effects/', '/examples/', '/playground/' ];
const to = 'site/src/lib/lighthouse.json';

execFileSync( 'npm', [ 'run', 'build', '--prefix', 'site' ], { stdio: 'ignore' } );
const server = spawn(
	'npx',
	[ 'vite', 'preview', '--port', String( port ), '--strictPort' ],
	{ cwd: 'site', stdio: 'ignore' }
);
process.on( 'exit', () => server.kill() );
await new Promise( ( done ) => setTimeout( done, 3000 ) );

const out = mkdtempSync( join( tmpdir(), 'lighthouse-' ) );
const written = JSON.parse( readFileSync( to, 'utf8' ) );
written.date = new Date().toISOString().slice( 0, 10 );

for ( const page of pages ) {
	written.pages[ page ] = {};
	for ( const mode of [ 'mobile', 'desktop' ] ) {
		const file = join( out, 'report.json' );
		execFileSync(
			'npx',
			[
				'--yes',
				'lighthouse',
				`http://localhost:${ port }${ page }`,
				...( mode === 'desktop' ? [ '--preset=desktop' ] : [] ),
				'--chrome-flags=--headless=new',
				'--output=json',
				`--output-path=${ file }`,
				'--quiet',
			],
			{
				stdio: 'ignore',
				env: { ...process.env, CHROME_PATH: chromium.executablePath() },
			}
		);
		const { categories, audits } = JSON.parse( readFileSync( file, 'utf8' ) );
		written.pages[ page ][ mode ] = Object.fromEntries(
			Object.entries( categories ).map( ( [ name, { score } ] ) => [
				name,
				Math.round( score * 100 ),
			] )
		);
		// eslint-disable-next-line no-console
		console.log(
			`${ page } ${ mode }: ` +
				Object.entries( written.pages[ page ][ mode ] )
					.map( ( pair ) => pair.join( ' ' ) )
					.join( ' · ' )
		);
		for ( const [ name, { score, scoreDisplayMode, displayValue } ] of Object.entries(
			audits
		) ) {
			if (
				score !== null &&
				score < 0.9 &&
				! [ 'informative', 'notApplicable', 'manual' ].includes(
					scoreDisplayMode
				)
			) {
				// eslint-disable-next-line no-console
				console.log( `    ${ name } ${ score } ${ displayValue || '' }` );
			}
		}
	}
}

writeFileSync( to, JSON.stringify( written, null, '\t' ) + '\n' );
process.exit();
