/**
 * Serves the site as it is built to a phone in the same network, so that
 * what a phone makes of the sliders can be tried and measured on one.
 *
 * `node bin/phone.mjs [port]`
 *
 * With https: WebGPU is there only where the address is secure, and an
 * address in the network is not, without. The certificate is made here
 * and signed by nobody, so the phone warns of it once; it is kept in
 * `site/.phone/`, which is not in the repo.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const port = process.argv[ 2 ] || '5443';
const folder = 'site/.phone';
const key = `${ folder }/key.pem`;
const cert = `${ folder }/cert.pem`;

const addresses = Object.values( networkInterfaces() )
	.flat()
	.filter( ( one ) => one && one.family === 'IPv4' && ! one.internal )
	.map( ( one ) => one.address );

if ( ! existsSync( key ) ) {
	mkdirSync( folder, { recursive: true } );
	execFileSync(
		'openssl',
		[
			'req',
			'-x509',
			'-newkey',
			'rsa:2048',
			'-nodes',
			'-days',
			'30',
			'-keyout',
			key,
			'-out',
			cert,
			'-subj',
			'/CN=shaderslide on a phone',
			'-addext',
			`subjectAltName=DNS:localhost,${ addresses
				.map( ( address ) => `IP:${ address }` )
				.join( ',' ) }`,
		],
		{ stdio: 'ignore' }
	);
}

// eslint-disable-next-line no-console
console.log( 'Building the site …' );
execFileSync( 'npm', [ 'run', 'build', '--prefix', 'site' ], { stdio: 'ignore' } );

const server = spawn(
	'npx',
	[ 'vite', 'preview', '--port', port, '--strictPort' ],
	{
		cwd: 'site',
		stdio: 'ignore',
		env: {
			...process.env,
			PHONE_KEY: `../${ key }`,
			PHONE_CERT: `../${ cert }`,
		},
	}
);
process.on( 'exit', () => server.kill() );
process.on( 'SIGINT', () => process.exit() );

// eslint-disable-next-line no-console
console.log(
	[
		'',
		'On the phone, in the same network:',
		...addresses.map( ( address ) => `    https://${ address }:${ port }/phone/` ),
		'',
		'The phone warns that nobody has signed the certificate: go on to the',
		'page all the same. Ctrl+C ends it.',
	].join( '\n' )
);
