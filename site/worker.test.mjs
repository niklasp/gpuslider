/**
 * The Worker, with the files of `dist/` as Cloudflare would serve them:
 * oEmbed, Markdown for agents, and the Link headers of the pages.
 *
 * `npm run build`, then `npm run test:worker`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import worker from './worker.js';

const dist = resolve( import.meta.dirname, 'dist' );
const TYPES = { html: 'text/html', md: 'text/markdown', txt: 'text/plain' };

// As `html_handling: auto-trailing-slash` and `not_found_handling:
// 404-page` do it, as far as these tests need.
const env = {
	ASSETS: {
		async fetch( request ) {
			const { pathname } = new URL( request.url ?? request );
			let file = resolve( dist, `.${ pathname }` );
			if ( pathname.endsWith( '/' ) ) {
				file = resolve( file, 'index.html' );
			}
			const there = existsSync( file );
			const body = readFileSync( there ? file : resolve( dist, '404.html' ) );
			return new Response( body, {
				status: there ? 200 : 404,
				headers: { 'Content-Type': TYPES[ ( there ? file : '.html' ).split( '.' ).pop() ] || 'application/octet-stream' },
			} );
		},
	},
};

const ask = ( path, headers = {} ) =>
	worker.fetch( new Request( `https://gpuslider.com${ path }`, { headers } ), env );
const oembed = ( page, more = '' ) =>
	ask( `/oembed?url=${ encodeURIComponent( page ) }&format=json${ more }` );

test( 'an example is a frame, with its title and its picture', async () => {
	const response = await oembed( 'https://gpuslider.com/examples/reveal/' );
	assert.equal( response.status, 200 );
	assert.equal( response.headers.get( 'Access-Control-Allow-Origin' ), '*' );
	const found = await response.json();
	assert.equal( found.type, 'rich' );
	assert.equal( found.version, '1.0' );
	assert.match( found.title, /^Reveal/ );
	assert.match( found.thumbnail_url, /^https:\/\/gpuslider\.com\/og\/.+\.jpg$/ );
	assert.match( found.html, /^<iframe src="https:\/\/gpuslider\.com\/examples\/reveal\/" width="800" height="450"/ );
} );

test( 'what the page is set to goes into the frame', async () => {
	const found = await ( await oembed( 'https://www.gpuslider.com/examples/echo/?frames=6#x' ) ).json();
	assert.match( found.html, /src="https:\/\/gpuslider\.com\/examples\/echo\/\?frames=6"/ );
} );

test( 'a frame fits in what it is given, at its proportion', async () => {
	const found = await ( await oembed( 'https://gpuslider.com/examples/reel/', '&maxwidth=400' ) ).json();
	assert.deepEqual( [ found.width, found.height ], [ 400, 300 ] );
	const small = await ( await oembed( 'https://gpuslider.com/playground', '&maxheight=225' ) ).json();
	assert.deepEqual( [ small.width, small.height ], [ 400, 225 ] );
	assert.match( small.html, /src="https:\/\/gpuslider\.com\/playground\/"/ );
} );

test( 'docs, other sites, missing pages and XML are not given', async () => {
	assert.equal( ( await oembed( 'https://gpuslider.com/docs/' ) ).status, 404 );
	assert.equal( ( await oembed( 'https://example.com/examples/reveal/' ) ).status, 404 );
	assert.equal( ( await oembed( 'https://gpuslider.com/examples/nothing/' ) ).status, 404 );
	assert.equal( ( await ask( '/oembed?url=nope' ) ).status, 400 );
	assert.equal( ( await ask( '/oembed?url=https%3A%2F%2Fgpuslider.com%2F&format=xml' ) ).status, 501 );
} );

test( 'a page says where its frame is', async () => {
	const html = await ( await ask( '/examples/reveal/' ) ).text();
	const link = html.match( /<link rel="alternate" type="application\/json\+oembed" href="([^"]+)"/ )[ 1 ];
	const response = await ask( new URL( link.replace( /&amp;/g, '&' ) ).pathname + new URL( link.replace( /&amp;/g, '&' ) ).search );
	assert.equal( response.status, 200 );
	assert.doesNotMatch( await ( await ask( '/docs/' ) ).text(), /json\+oembed/ );
} );

test( 'agents still get Markdown, and pages their Link headers', async () => {
	const markdown = await ask( '/docs/compared/', { Accept: 'text/markdown' } );
	assert.match( markdown.headers.get( 'Content-Type' ), /^text\/markdown/ );
	const page = await ask( '/docs/' );
	assert.match( page.headers.get( 'Link' ), /llms\.txt/ );
} );
