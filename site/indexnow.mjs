/**
 * After a deploy: tells the search engines of IndexNow (Bing, Yandex,
 * Seznam, Naver; Bing is what ChatGPT and Copilot search with) that the
 * pages of the sitemap are there, or new. The key is the file of 32
 * characters in `public/`, which the engines fetch to know the site is
 * ours.
 *
 * `npx wrangler deploy && node indexnow.mjs`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ORIGIN = ( process.env.SITE_URL || 'https://gpuslider.com' ).replace( /\/$/, '' );
const file = readdirSync( resolve( import.meta.dirname, 'public' ) ).find( ( name ) =>
	/^[0-9a-f]{32}\.txt$/.test( name )
);
const key = readFileSync( resolve( import.meta.dirname, 'public', file ), 'utf8' ).trim();

const sitemap = await ( await fetch( `${ ORIGIN }/sitemap.xml` ) ).text();
const urlList = [ ...sitemap.matchAll( /<loc>([^<]+)<\/loc>/g ) ].map( ( [ , url ] ) => url );

const response = await fetch( 'https://api.indexnow.org/indexnow', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json; charset=utf-8' },
	body: JSON.stringify( {
		host: new URL( ORIGIN ).host,
		key,
		keyLocation: `${ ORIGIN }/${ file }`,
		urlList,
	} ),
} );
// 200 and 202 are what IndexNow answers when it takes them.
// eslint-disable-next-line no-console
console.log( `IndexNow: ${ urlList.length } pages, ${ response.status } ${ response.statusText }` );
process.exitCode = response.ok ? 0 : 1;
