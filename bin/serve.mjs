/**
 * Static server for the tests and for `bench/`: serves the repo root. The
 * library is TypeScript: `src/x.js` is `src/x.ts` made JavaScript, as it is
 * asked for.
 *
 * `node bin/serve.mjs [port]`
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { transform } from 'esbuild';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve( fileURLToPath( import.meta.url ), '../..' );
const port = Number( process.argv[ 2 ] ) || 4173;

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
};

createServer( async ( request, response ) => {
	const { pathname } = new URL( request.url, 'http://localhost' );
	let file = join( root, normalize( decodeURIComponent( pathname ) ) );
	if ( ! file.startsWith( root ) ) {
		response.writeHead( 403 ).end();
		return;
	}
	const ts = file.replace( /\.js$/, '.ts' );
	if ( ts !== file && ! existsSync( file ) && existsSync( ts ) ) {
		const { code } = await transform( readFileSync( ts, 'utf8' ), {
			loader: 'ts',
			format: 'esm',
			target: 'es2022',
		} );
		response
			.writeHead( 200, {
				'Content-Type': TYPES[ '.js' ],
				'Cache-Control': 'no-store',
			} )
			.end( code );
		return;
	}
	let stat;
	try {
		stat = statSync( file );
		if ( stat.isDirectory() ) {
			file = join( file, 'index.html' );
			stat = statSync( file );
		}
	} catch {
		response.writeHead( 404 ).end( 'Not found' );
		return;
	}
	const headers = {
		'Content-Type': TYPES[ extname( file ) ] || 'application/octet-stream',
		'Cache-Control': 'no-store',
		'Accept-Ranges': 'bytes',
	};
	// Videos: Safari only plays what it can request in ranges.
	const range = /^bytes=(\d*)-(\d*)$/.exec( request.headers.range || '' );
	if ( range ) {
		const start = Number( range[ 1 ] ) || 0;
		const end = range[ 2 ] ? Number( range[ 2 ] ) : stat.size - 1;
		response.writeHead( 206, {
			...headers,
			'Content-Range': `bytes ${ start }-${ end }/${ stat.size }`,
			'Content-Length': end - start + 1,
		} );
		createReadStream( file, { start, end } ).pipe( response );
		return;
	}
	response.writeHead( 200, { ...headers, 'Content-Length': stat.size } );
	createReadStream( file ).pipe( response );
} ).listen( port, () => {
	// eslint-disable-next-line no-console
	console.log( `http://localhost:${ port }/bench/` );
} );
