/**
 * Builds `dist/` and prints what each part costs, gzipped.
 *
 * `node bin/build.mjs`          build and report
 * `node bin/build.mjs --check`  also fail when a part is over its budget
 *
 * The budgets are the ones in PLAN.md.
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve( fileURLToPath( import.meta.url ), '../..' );
const check = process.argv.includes( '--check' );

/**
 * Bundles a piece of code and measures it.
 *
 * @param {string} source What to bundle, as the text of an entry module.
 * @param {string} [out]  File in `dist/` to write, if any.
 * @return {Promise<number>} Gzipped size in bytes.
 */
async function measure( source, out ) {
	const result = await build( {
		stdin: { contents: source, resolveDir: root, loader: 'js' },
		bundle: true,
		minify: true,
		format: 'esm',
		target: 'es2022',
		write: false,
		legalComments: 'none',
	} );
	const code = result.outputFiles[ 0 ].contents;
	if ( out ) {
		const { mkdirSync, writeFileSync } = await import( 'node:fs' );
		mkdirSync( resolve( root, 'dist' ), { recursive: true } );
		writeFileSync( resolve( root, 'dist', out ), code );
	}
	return gzipSync( code, { level: 9 } ).length;
}

const parts = [];

parts.push( {
	name: 'core',
	budget: 6144,
	size: await measure(
		`export * from './src/index.js';`,
		'shaderslide.js'
	),
} );

if ( existsSync( resolve( root, 'src/gl/index.js' ) ) ) {
	await measure( `export * from './src/gl/index.js';`, 'shaderslide-gl.js' );
	parts.push( {
		name: 'canvas layer, no effects',
		budget: 6144,
		size: await measure(
			`import { gl } from './src/gl/index.js'; export { gl };`
		),
	} );
	const dir = resolve( root, 'src/gl/effects' );
	for ( const file of readdirSync( dir ).sort() ) {
		if ( ! file.endsWith( '.js' ) || file === 'index.js' ) {
			continue;
		}
		parts.push( {
			name: `effect: ${ file.replace( '.js', '' ) }`,
			budget: 1024,
			size: await measure(
				`export * from './src/gl/effects/${ file }';`
			),
		} );
	}
}

let failed = false;
for ( const { name, size, budget } of parts ) {
	const over = size > budget;
	failed ||= over;
	// eslint-disable-next-line no-console
	console.log(
		`${ name.padEnd( 28 ) } ${ String( size ).padStart( 6 ) } B` +
			`  of ${ budget }${ over ? '  OVER BUDGET' : '' }`
	);
}
if ( check && failed ) {
	process.exit( 1 );
}
