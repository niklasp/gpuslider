import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { docs } from './docs.ts';

// The site uses the library as it is in the repo, not a build of it.
export default defineConfig( {
	plugins: [ react(), tailwindcss(), docs() ],
	// The generated media of the repo: /media/1.jpg
	publicDir: path.resolve( import.meta.dirname, 'public' ),
	resolve: {
		// The library is outside of the site: one React for both.
		dedupe: [ 'react', 'react-dom' ],
		alias: {
			'@': path.resolve( import.meta.dirname, './src' ),
			'shaderslide/canvas': path.resolve( import.meta.dirname, '../src/canvas.js' ),
			'shaderslide/effects': path.resolve( import.meta.dirname, '../src/effects.js' ),
			'shaderslide/gpu': path.resolve( import.meta.dirname, '../src/gpu/index.js' ),
			'shaderslide/gl': path.resolve( import.meta.dirname, '../src/gl/index.js' ),
			'shaderslide/lightbox': path.resolve( import.meta.dirname, '../src/lightbox.js' ),
			'shaderslide/react': path.resolve( import.meta.dirname, '../src/react.js' ),
			'shaderslide/auto': path.resolve( import.meta.dirname, '../src/auto.js' ),
			'shaderslide/full': path.resolve( import.meta.dirname, '../src/full.js' ),
			'shaderslide/plugins': path.resolve( import.meta.dirname, '../src/plugins/index.js' ),
			'shaderslide/style.css': path.resolve( import.meta.dirname, '../src/style.css' ),
			'shaderslide/lightbox.css': path.resolve( import.meta.dirname, '../src/lightbox.css' ),
			'shaderslide/loading.css': path.resolve( import.meta.dirname, '../src/loading.css' ),
			shaderslide: path.resolve( import.meta.dirname, '../src/index.js' ),
		},
	},
	// Pages of their own: what is not there is not found, and is not the
	// first page.
	appType: 'mpa',
	build: {
		rollupOptions: {
			// The pages of the docs are made of `docs/index.html`, by
			// `prerender.mjs`.
			input: Object.fromEntries(
				[
					'index',
					'docs/index',
					'examples/index',
					'examples/wall/index',
					'examples/reel/index',
					'examples/tape/index',
					'playground/index',
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
} );
