import { defineConfig } from '@playwright/test';

const port = 4174;

export default defineConfig( {
	testDir: 'tests',
	fullyParallel: true,
	reporter: 'list',
	use: {
		baseURL: `http://localhost:${ port }`,
		viewport: { width: 1000, height: 700 },
	},
	webServer: {
		command: `node bin/serve.mjs ${ port }`,
		port,
		reuseExistingServer: true,
	},
} );
