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
	budget: 5120,
	size: await measure(
		`export * from './src/index.js';`,
		'shaderslide.js'
	),
} );

for ( const file of readdirSync( resolve( root, 'src/plugins' ) ).sort() ) {
	// Helpers have no plugin of their name.
	if ( [ 'index.js', 'elements.js', 'screen.js' ].includes( file ) ) {
		continue;
	}
	parts.push( {
		name: `plugin: ${ file.replace( '.js', '' ) }`,
		budget: 1024,
		size: await measure( `export * from './src/plugins/${ file }';` ),
	} );
}

parts.push( {
	name: 'full: the core and all plugins',
	budget: 7168,
	size: await measure(
		`export * from './src/full.js';`,
		'shaderslide-full.js'
	),
} );

if ( existsSync( resolve( root, 'src/gl/index.js' ) ) ) {
	await measure( `export * from './src/gl/index.js';`, 'shaderslide-gl.js' );
	parts.push( {
		name: 'canvas layer, no effects',
		budget: 6656,
		size: await measure(
			`import { gl } from './src/gl/index.js'; export { gl };`
		),
	} );
	for ( const kind of [ 'effects', 'transitions' ] ) {
		const dir = resolve( root, 'src/gl', kind );
		for ( const file of readdirSync( dir ).sort() ) {
			if ( ! file.endsWith( '.js' ) || file === 'index.js' ) {
				continue;
			}
			parts.push( {
				name: `${ kind.slice( 0, -1 ) }: ${ file.replace( '.js', '' ) }`,
				budget: 1024,
				size: await measure(
					`export * from './src/gl/${ kind }/${ file }';`
				),
			} );
		}
	}
}

// What the lightbox adds to a page that has the slider and the canvas.
if ( existsSync( resolve( root, 'src/lightbox.js' ) ) ) {
	await measure( `export * from './src/lightbox.js';`, 'shaderslide-lightbox.js' );
	// It has arrows and keys of its own, so a page with them is what it
	// is added to.
	const both = `import { createSlider } from './src/index.js'; import { controls, keyboard } from './src/plugins/index.js'; import { gl } from './src/gl/index.js';`;
	parts.push( {
		name: 'lightbox',
		budget: 2048,
		size:
			( await measure(
				`${ both } import { lightbox } from './src/lightbox.js'; export { createSlider, controls, keyboard, gl, lightbox };`
			) ) - ( await measure( `${ both } export { createSlider, controls, keyboard, gl };` ) ),
	} );
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
