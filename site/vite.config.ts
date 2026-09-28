import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The site uses the library as it is in the repo, not a build of it.
export default defineConfig( {
	plugins: [ react(), tailwindcss() ],
	// The generated media of the repo: /media/1.jpg
	publicDir: path.resolve( import.meta.dirname, 'public' ),
	resolve: {
		alias: {
			'@': path.resolve( import.meta.dirname, './src' ),
			'shaderslide/gl': path.resolve( import.meta.dirname, '../src/gl/index.js' ),
			'shaderslide/lightbox': path.resolve( import.meta.dirname, '../src/lightbox.js' ),
			'shaderslide/full': path.resolve( import.meta.dirname, '../src/full.js' ),
			'shaderslide/plugins': path.resolve( import.meta.dirname, '../src/plugins/index.js' ),
			'shaderslide/style.css': path.resolve( import.meta.dirname, '../src/style.css' ),
			shaderslide: path.resolve( import.meta.dirname, '../src/index.js' ),
		},
	},
	server: {
		port: 5183,
		fs: { allow: [ '..' ] },
	},
} );
