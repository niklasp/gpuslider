import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { docs } from './docs.ts';

// The site uses the library as it is in the repo, not a build of it.
const library = path.resolve( import.meta.dirname, '../src' ) + path.sep;
// Where a module is in the library; nothing for another.
const lib = ( id: string ) =>
	id.startsWith( library ) ? id.slice( library.length ).split( path.sep ).join( '/' ) : '';

export default defineConfig( {
	plugins: [
		react(),
		tailwindcss(),
		docs(),
		{
			// The journal as the build has it, rendered on the server: a
			// view transition between its pages needs the picture of the
			// page that comes in its HTML, and its styles in the head.
			name: 'journal',
			configureServer( server ) {
				server.middlewares.use( async ( request, response, next ) => {
					const [ , slug ] =
						( request.url || '' ).match( /^\/examples\/journal\/(?:([a-z-]+)\/)?(?:\?.*)?$/ ) || [];
					if ( slug === undefined && ! /^\/examples\/journal\/(\?.*)?$/.test( request.url || '' ) ) {
						return next();
					}
					try {
						const page = `examples/journal/${ slug ? `${ slug }/` : '' }index.html`;
						const { render } = await server.ssrLoadModule( '/src/entry-server.tsx' );
						const markup = await render( page );
						const html = await server.transformIndexHtml(
							request.url!,
							readFileSync( path.resolve( import.meta.dirname, 'examples/journal/index.html' ), 'utf8' )
						);
						response.setHeader( 'Content-Type', 'text/html' );
						response.end(
							html
								.replace(
									'</head>',
									`<link rel="stylesheet" href="/@fs${ library }style.css"><link rel="stylesheet" href="/src/pages/journal/journal.css"></head>`
								)
								.replace( '<div id="root"></div>', () => `<div id="root">${ markup }</div>` )
						);
					} catch ( error ) {
						next( error );
					}
				} );
			},
		},
		{
			// The stages of the wave are pages of one file, as the build
			// makes them (see `entry-server.tsx`).
			name: 'wave',
			configureServer( server ) {
				server.middlewares.use( ( request, _, next ) => {
					const [ address, query ] = ( request.url || '' ).split( '?' );
					if ( /^\/examples\/wave\/[a-z]+\/$/.test( address ) ) {
						request.url = `/examples/wave/index.html${ query ? `?${ query }` : '' }`;
					}
					next();
				} );
			},
		},
	],
	// The generated media of the repo: /media/1.jpg
	publicDir: path.resolve( import.meta.dirname, 'public' ),
	resolve: {
		// The library is outside of the site: one React for both.
		dedupe: [ 'react', 'react-dom' ],
		alias: {
			'@': path.resolve( import.meta.dirname, './src' ),
			'gpuslider/canvas': path.resolve( import.meta.dirname, '../src/canvas.js' ),
			'gpuslider/effects': path.resolve( import.meta.dirname, '../src/effects.js' ),
			'gpuslider/gpu': path.resolve( import.meta.dirname, '../src/gpu/index.js' ),
			'gpuslider/gl': path.resolve( import.meta.dirname, '../src/gl/index.js' ),
			'gpuslider/lightbox': path.resolve( import.meta.dirname, '../src/lightbox.js' ),
			'gpuslider/react': path.resolve( import.meta.dirname, '../src/react.js' ),
			'gpuslider/auto': path.resolve( import.meta.dirname, '../src/auto.js' ),
			'gpuslider/full': path.resolve( import.meta.dirname, '../src/full.js' ),
			'gpuslider/plugins': path.resolve( import.meta.dirname, '../src/plugins/index.js' ),
			'gpuslider/style.css': path.resolve( import.meta.dirname, '../src/style.css' ),
			'gpuslider/lightbox.css': path.resolve( import.meta.dirname, '../src/lightbox.css' ),
			'gpuslider/loading.css': path.resolve( import.meta.dirname, '../src/loading.css' ),
			gpuslider: path.resolve( import.meta.dirname, '../src/index.js' ),
		},
	},
	// Pages of their own: what is not there is not found, and is not the
	// first page.
	appType: 'mpa',
	build: {
		rolldownOptions: {
			// The library in four files instead of forty of a few hundred
			// bytes each: the core, the plugins, the canvas and the
			// effects. Its layers stay apart, a page loads one of them.
			output: {
				codeSplitting: {
					// What a module of the library imports, React for one,
					// stays where it would be.
					includeDependenciesRecursively: false,
					groups: [
						{
							name: 'slider',
							test: ( id: string ) =>
								/^(index|engine|layout|input|dom|react)\.js/.test( lib( id ) ),
						},
						{
							name: 'plugins',
							test: ( id: string ) => lib( id ).startsWith( 'plugins/' ),
						},
						{
							name: 'canvas',
							test: ( id: string ) =>
								/^(canvas|hit|lightbox)\.js|^gl\/(fit|glsl)/.test( lib( id ) ),
						},
						{
							name: 'effects',
							test: ( id: string ) => /^gl\/(effects|transitions)\//.test( lib( id ) ),
						},
					],
				},
			},
			// The pages of the docs are made of `docs/index.html`, by
			// `prerender.mjs`.
			input: Object.fromEntries(
				[
					'index',
					'docs/index',
					'examples/index',
					'examples/reel/index',
					'examples/tape/index',
					'examples/loom/index',
					'examples/wave/index',
					'examples/depth/index',
					'examples/journal/index',
					'examples/orbit/index',
					'examples/fold/index',
					'examples/resolve/index',
					'examples/reveal/index',
					'examples/echo/index',
					'playground/index',
					'phone/index',
				].map( ( page ) => [
					page.replaceAll( '/', '-' ),
					path.resolve( import.meta.dirname, `${ page }.html` ),
				] )
			),
		},
	},
	server: {
		port: 5183,
		fs: { allow: [ '..' ] },
	},
	// For a phone in the same network, `npm run phone`: with https, which
	// WebGPU asks for where the address is not this machine.
	preview: process.env.PHONE_KEY
		? {
				host: true,
				https: {
					key: readFileSync( process.env.PHONE_KEY ),
					cert: readFileSync( process.env.PHONE_CERT! ),
				},
		  }
		: {},
} );
