import { defineConfig, devices } from '@playwright/test';

const port = 4174;
const site = 5184;

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
			name: 'site',
			testDir: 'site/tests',
			use: {
				...devices[ 'Desktop Chrome' ],
				baseURL: `http://localhost:${ site }`,
				viewport: { width: 1300, height: 800 },
				launchOptions: {
					// As below.
					args:
						process.env.LAYER === 'gpu'
							? [ '--enable-unsafe-webgpu', '--use-angle=metal' ]
							: [
									'--enable-unsafe-swiftshader',
									'--ignore-gpu-blocklist',
							  ],
				},
			},
		},
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
				viewport: { width: 1000, height: 700 },
				launchOptions: {
					// WebGL without a GPU, for machines that have none. For
					// WebGPU (LAYER=gpu) there has to be one: a browser
					// without a window has it only when asked, and draws
					// nothing with the GPU that is software. Metal is what
					// a Mac has.
					args:
						process.env.LAYER === 'gpu'
							? [ '--enable-unsafe-webgpu', '--use-angle=metal' ]
							: [
									'--enable-unsafe-swiftshader',
									'--ignore-gpu-blocklist',
							  ],
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
	webServer: [
		{
			command: `node bin/serve.mjs ${ port }`,
			port,
			reuseExistingServer: true,
		},
		{
			command: `npm run dev --prefix site -- --port ${ site } --strictPort`,
			port: site,
			reuseExistingServer: true,
		},
	],
} );
