/**
 * Prints what each part costs in the bundle of somebody who imports it,
 * gzipped, and builds `dist/`: the files for pages without a bundler.
 *
 * `node bin/build.mjs`          build and report
 * `node bin/build.mjs --check`  also fail when a part is over its budget
 *
 * The budgets are the ones in PLAN.md.
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactIn } from './glsl.mjs';

const root = resolve( fileURLToPath( import.meta.url ), '../..' );
const check = process.argv.includes( '--check' );

const common = {
	bundle: true,
	minify: true,
	format: 'esm',
	target: 'es2022',
	legalComments: 'none',
};

/**
 * Bundles a piece of code and measures it.
 *
 * @param {string}   source     What to bundle, as the text of an entry
 *                            module.
 * @param {string[]} [external] What is not bundled with it.
 * @return {Promise<number>} Gzipped size in bytes.
 */
async function measure( source, external = [] ) {
	const result = await build( {
		...common,
		external,
		stdin: { contents: source, resolveDir: root, loader: 'js' },
		write: false,
	} );
	return gzipSync( result.outputFiles[ 0 ].contents, { level: 9 } ).length;
}

const parts = [];

parts.push( {
	name: 'core',
	budget: 5120,
	size: await measure( `export * from './src/index.js';` ),
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
	name: 'react: what useSlider adds',
	budget: 512,
	size:
		( await measure(
			`export * from './src/react.js';`,
			[ 'react' ]
		) ) - parts[ 0 ].size,
} );

parts.push( {
	name: 'full: the slider with all its options',
	budget: 7168,
	size: await measure(
		`import { createSlider } from './src/full.js'; export { createSlider };`
	),
} );

if ( existsSync( resolve( root, 'src/gl/index.js' ) ) ) {
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

// What a page has in its bundle that imports by name from the files that
// have everything: what it names, and no more.
parts.push(
	{
		name: 'a page in React: arrows and dots',
		budget: 5632,
		size: await measure(
			`import { useSlider } from './src/react.js'; import { controls } from './src/plugins/index.js'; export { useSlider, controls };`,
			[ 'react' ]
		),
	},
	{
		name: 'the same with the canvas and stretch',
		budget: 12288,
		size: await measure(
			`import { useSlider } from './src/react.js'; import { controls } from './src/plugins/index.js'; import { gl, stretch } from './src/gl/index.js'; export { useSlider, controls, gl, stretch };`,
			[ 'react' ]
		),
	}
);

// What the lightbox adds to a page that has the slider and the canvas.
if ( existsSync( resolve( root, 'src/lightbox.js' ) ) ) {
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
		`${ name.padEnd( 38 ) } ${ String( size ).padStart( 6 ) } B` +
			`  of ${ budget }${ over ? '  OVER BUDGET' : '' }`
	);
}

// What pages without a bundler load: the same entries, which share what
// they have in common, and the shaders without what only people read.
const dist = resolve( root, 'dist' );
rmSync( dist, { recursive: true, force: true } );
const to = { ...common, absWorkingDir: root, outdir: dist, metafile: true };
const built = await Promise.all( [
	build( {
		...to,
		entryPoints: {
			index: 'src/index.js',
			full: 'src/full.js',
			plugins: 'src/plugins/index.js',
			gl: 'src/gl/index.js',
			lightbox: 'src/lightbox.js',
		},
		splitting: true,
		chunkNames: 'chunks/[hash]',
		plugins: [
			{
				name: 'glsl',
				setup( { onLoad } ) {
					onLoad( { filter: /\/src\/gl\/.*\.js$/ }, ( { path } ) => ( {
						contents: compactIn( readFileSync( path, 'utf8' ) ),
					} ) );
				},
			},
		],
	} ),
	// One file, for one request. The canvas and the lightbox are the files
	// above, which it loads when a slider asks for them.
	build( {
		...to,
		entryPoints: { auto: 'src/auto.js' },
		plugins: [
			{
				name: 'later',
				setup( { onResolve } ) {
					onResolve( { filter: /.*/ }, ( { kind, path } ) =>
						kind === 'dynamic-import'
							? {
									path: path.replace( '/index.js', '.js' ),
									external: true,
							  }
							: null
					);
				},
			},
		],
	} ),
	build( {
		...to,
		entryPoints: { style: 'src/style.css', lightbox: 'src/lightbox.css' },
	} ),
] );
const metafile = {
	outputs: Object.assign( {}, ...built.map( ( one ) => one.metafile.outputs ) ),
};

// A file and what it loads with it; what it loads later is not counted.
const withAll = ( file, seen = new Set() ) => {
	if ( ! seen.has( file ) ) {
		seen.add( file );
		metafile.outputs[ file ].imports
			.filter(
				( { kind, external } ) =>
					kind === 'import-statement' && ! external
			)
			.forEach( ( { path } ) => withAll( path, seen ) );
	}
	return seen;
};
// eslint-disable-next-line no-console
console.log( '\ndist/, each with the files it loads with it' );
for ( const file of Object.keys( metafile.outputs ).sort() ) {
	if ( file.includes( 'chunks/' ) ) {
		continue;
	}
	const size = [ ...withAll( file ) ].reduce(
		( sum, part ) =>
			sum +
			gzipSync( readFileSync( resolve( root, part ) ), { level: 9 } )
				.length,
		0
	);
	// eslint-disable-next-line no-console
	console.log(
		`${ relative( dist, resolve( root, file ) ).padEnd( 38 ) } ${ String(
			size
		).padStart( 6 ) } B`
	);
}

if ( check && failed ) {
	process.exit( 1 );
}
