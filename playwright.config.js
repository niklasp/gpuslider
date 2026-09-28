import { defineConfig, devices } from '@playwright/test';

const port = 4174;

export default defineConfig( {
	testDir: 'tests',
	fullyParallel: true,
	reporter: 'list',
	use: {
		baseURL: `http://localhost:${ port }`,
		viewport: { width: 1000, height: 700 },
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
				viewport: { width: 1000, height: 700 },
				launchOptions: {
					// WebGL without a GPU, for machines that have none.
					args: [ '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist' ],
				},
			},
		},
		{
			name: 'firefox',
			use: {
				...devices[ 'Desktop Firefox' ],
				viewport: { width: 1000, height: 700 },
			},
		},
		{
			name: 'webkit',
			use: {
				...devices[ 'Desktop Safari' ],
				viewport: { width: 1000, height: 700 },
			},
		},
	],
	webServer: {
		command: `node bin/serve.mjs ${ port }`,
		port,
		reuseExistingServer: true,
	},
} );
