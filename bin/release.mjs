/**
 * Puts out a new version: tests, the version, npm, GitHub and the site.
 *
 *     npm run release            # 1.0.2 → 1.0.3, fixes
 *     npm run release:minor      # 1.0.2 → 1.1.0, something new
 *     npm run release:major      # 1.0.2 → 2.0.0, something that breaks
 *
 * In order: `main` is clean and as GitHub has it, and npm knows you; the
 * tests pass (types, sizes, the three browsers, WebGPU, `dist/`); the
 * version goes up (and the CDN paths with a major); `dist/` and the types
 * are built; a commit and a tag; npm publishes, confirmed in the browser;
 * the commit and the tag go to GitHub; the site goes online.
 *
 * The tests run with half the workers, so that a busy machine does not
 * fail them for time; a test that fails is run again once, alone, and
 * only one that fails again stops the release.
 *
 * `--no-tests` leaves the browser tests out; the types and sizes are
 * still checked.
 * `--no-site` does not put the site online. `--publish-only` goes on
 * from a release whose publishing failed: it publishes the version that
 * is committed, then pushes and puts the site online.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice( 2 );
const has = ( flag ) => args.includes( flag );
const step = args.find( ( one ) => [ 'patch', 'minor', 'major' ].includes( one ) ) || 'patch';

const say = ( text ) =>
	// eslint-disable-next-line no-console
	console.log( `\n\x1b[1m▸ ${ text }\x1b[0m` );
const fail = ( text ) => {
	// eslint-disable-next-line no-console
	console.error( `\n\x1b[31m✗ ${ text }\x1b[0m` );
	process.exit( 1 );
};
const out = ( command, ...rest ) => execFileSync( command, rest, { encoding: 'utf8' } ).trim();
// A command that the terminal sees, as if typed: its output, and its
// questions.
const run = ( command, rest, env = {} ) =>
	spawnSync( command, rest, {
		stdio: 'inherit',
		env: { ...process.env, ...env },
	} ).status === 0;
const version = () => JSON.parse( readFileSync( 'package.json', 'utf8' ) ).version;

// Tests with half the workers; what fails is run once more, alone.
const tests = ( name, rest, env = {} ) => {
	say( `Tests: ${ name }` );
	if ( run( 'npx', [ 'playwright', 'test', '--workers=50%', ...rest ], env ) ) {
		return;
	}
	say( `Tests: ${ name }, the ones that failed, again and alone` );
	if ( ! run( 'npx', [ 'playwright', 'test', '--last-failed', '--workers=1', ...rest ], env ) ) {
		fail( `Tests of ${ name } fail. Nothing is released.` );
	}
};

const publish = () => {
	say( `npm: gpuslider@${ version() }, confirmed in the browser` );
	// npm 12 confirms with a passkey in the browser; npm 10 asks for a code.
	if ( ! run( 'npx', [ '--yes', 'npm@latest', 'publish', '--access', 'public', '--ignore-scripts', '--auth-type=web' ] ) ) {
		fail(
			'npm did not publish it. The commit and the tag are here and not on GitHub yet.\n' +
				'  Once npm lets you (logged in? `npm login`), go on with: npm run release -- --publish-only'
		);
	}
};

const online = () => {
	say( 'GitHub: the commit and the tag' );
	if ( ! run( 'git', [ 'push', '--follow-tags', 'origin', 'main' ] ) ) {
		fail( 'The push failed. npm has the version; push by hand: git push --follow-tags origin main' );
	}
	if ( ! has( '--no-site' ) ) {
		say( 'The site' );
		const built = run( 'npm', [ 'run', 'build', '--prefix', 'site' ] );
		if ( ! built || spawnSync( 'npx', [ 'wrangler', 'deploy' ], { cwd: 'site', stdio: 'inherit' } ).status !== 0 ) {
			fail( 'The site did not go online. npm and GitHub have the version; try: npm run build --prefix site, then npx wrangler deploy in site/' );
		}
	}
	say( `Out: gpuslider@${ version() }` );
	// eslint-disable-next-line no-console
	console.log( `  https://www.npmjs.com/package/gpuslider\n  https://github.com/niklasp/gpuslider/releases/tag/v${ version() }\n  The CDN has it within about ten minutes.` );
};

// What has to be so before anything is changed.
say( 'Checks' );
if ( out( 'git', 'rev-parse', '--abbrev-ref', 'HEAD' ) !== 'main' ) {
	fail( 'Releases are made from main.' );
}
if ( out( 'git', 'status', '--porcelain' ) ) {
	fail( 'There are changes that are not committed.' );
}
out( 'git', 'fetch', 'origin', 'main' );
if ( out( 'git', 'rev-list', '--count', 'HEAD..origin/main' ) !== '0' ) {
	fail( 'GitHub has commits that are not here: git pull first.' );
}
try {
	// eslint-disable-next-line no-console
	console.log( `  npm knows you as ${ out( 'npm', 'whoami' ) }` );
} catch {
	fail( 'npm does not know you here: npm login' );
}

if ( has( '--publish-only' ) ) {
	const on = spawnSync( 'npm', [ 'view', `gpuslider@${ version() }`, 'version' ], { encoding: 'utf8' } ).stdout.trim();
	if ( on ) {
		fail( `npm has gpuslider@${ version() } already: nothing to go on with.` );
	}
	if ( ! out( 'git', 'tag', '-l', `v${ version() }` ) ) {
		out( 'git', 'tag', '-a', `v${ version() }`, '-m', `gpuslider ${ version() }` );
	}
	say( 'lib/, dist/ and the types' );
	if ( ! run( 'node', [ 'bin/build.mjs', '--check' ] ) || ! run( 'npm', [ 'run', 'types' ] ) ) {
		fail( 'The build failed.' );
	}
	publish();
	online();
	process.exit( 0 );
}

// The types and the sizes take seconds: they are checked always.
say( 'Types and sizes' );
if ( ! run( 'npm', [ 'run', 'check' ] ) ) {
	fail( 'The library does not type-check. Nothing is released.' );
}
if ( ! run( 'npm', [ 'run', 'types' ] ) || ! run( 'npm', [ 'run', 'size' ] ) ) {
	fail( 'Types or sizes fail. Nothing is released.' );
}
if ( has( '--no-tests' ) ) {
	say( 'Tests: left out, as asked' );
} else {
	tests( 'Chromium, Firefox, WebKit and the site', [] );
	tests( 'drawn by WebGPU', [ '--project=chromium', '--project=webkit', '--project=site' ], { LAYER: 'gpu' } );
	if ( ! run( 'node', [ 'bin/build.mjs' ] ) ) {
		fail( 'dist/ could not be built.' );
	}
	tests( 'with what is built, dist/', [], { FROM: 'dist' } );
}

say( `Version: ${ step }` );
const before = version();
out( 'npm', 'version', step, '--no-git-tag-version' );
const after = version();
// eslint-disable-next-line no-console
console.log( `  ${ before } → ${ after }` );
const [ was, is ] = [ before, after ].map( ( one ) => one.split( '.' )[ 0 ] );
if ( was !== is ) {
	// The CDN paths take the newest of a major version.
	for ( const file of [ 'README.md', 'DOCS.md', 'src/auto.ts' ] ) {
		writeFileSync(
			file,
			readFileSync( file, 'utf8' ).replaceAll( `gpuslider@${ was }/`, `gpuslider@${ is }/` )
		);
	}
}

say( 'lib/, dist/ and the types' );
if ( ! run( 'node', [ 'bin/build.mjs', '--check' ] ) || ! run( 'npm', [ 'run', 'types' ] ) ) {
	fail( 'The build failed. The version is changed here and nothing else: git checkout . to go back.' );
}

say( `Commit and tag: v${ after }` );
out( 'git', 'add', 'package.json', 'package-lock.json', 'README.md', 'DOCS.md', 'src/auto.ts', 'site/src/lib/sizes.json' );
out( 'git', 'commit', '-m', `gpuslider ${ after }` );
out( 'git', 'tag', '-a', `v${ after }`, '-m', `gpuslider ${ after }` );

publish();
online();
