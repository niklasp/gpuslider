/**
 * The exact tests of the shaders in WGSL (see `tests/exact.js`), run in
 * Node through Dawn, without a browser: what the `vertex` of every effect
 * that lays out gives, against what its `place()` gives in JS.
 *
 *     npm install --no-save webgpu   # Dawn for Node, 130 MB: not a dependency
 *     npm run build                  # lib/, which this reads
 *     node bin/exact-node.mjs
 *
 * What needs a page (the layout, the pointer, pictures of the canvas) stays
 * with the tests in the browsers.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve( fileURLToPath( import.meta.url ), '../..' );
const from = ( path ) => pathToFileURL( resolve( root, path ) ).href;

let dawn;
try {
	dawn = await import( 'webgpu' );
} catch {
	console.log( 'Dawn for Node is not installed: npm install --no-save webgpu' );
	process.exit( 0 );
}
if ( ! existsSync( resolve( root, 'lib/gpu/wgsl.js' ) ) ) {
	console.log( 'lib/ is not built: npm run build' );
	process.exit( 1 );
}

Object.assign( globalThis, dawn.globals );
// Kept for as long as the device is used: collected, it takes Dawn down.
const gpu = dawn.create( [] );
const adapter = await gpu.requestAdapter();
const device = await adapter?.requestDevice();
if ( ! device ) {
	console.log( 'Dawn has no adapter here.' );
	process.exit( 1 );
}

const effects = await import( from( 'lib/gl/effects/index.js' ) );
const { wgsl, rename } = await import( from( 'lib/gpu/wgsl.js' ) );
const { runWgsl, expected, apart, CASES } = await import( from( 'tests/exact.js' ) );

let failed = 0;
for ( const [ name, make ] of Object.entries( effects ) ) {
	const effect = make();
	if ( ! effect.place || ! effect.vertex ) {
		continue;
	}
	const got = await runWgsl( device, effect, wgsl, rename );
	const worst = Math.max(
		...got.map( ( points, i ) => apart( points, expected( effect, CASES[ i ] ) ) )
	);
	const ok = worst < 0.01;
	failed += ok ? 0 : 1;
	console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ name.padEnd( 10 ) } ${ worst.toExponential( 2 ) } px apart at most` );
}
device.destroy();
process.exit( failed ? 1 : 0 );
