/**
 * In front of the files of `dist/`, for pages only (see `wrangler.jsonc`):
 *
 * - A request that accepts text/markdown gets the page as Markdown, where
 *   the build wrote one beside its HTML (`index.md`).
 * - The HTML says where agents find more, in `Link` headers, and that it
 *   varies with `Accept`.
 * - `/oembed?url=<page>` gives a page as a frame for other sites (oEmbed):
 *   paste its link in Notion, Ghost, WordPress or Medium, and the slider
 *   runs there. Which pages, and how large: `embed.js`.
 */
import { embeddable, frame } from './embed.js';

const LINKS = [
	'</llms.txt>; rel="describedby"; type="text/plain"',
	'</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
	'</docs/>; rel="service-doc"',
].join( ', ' );

const NAME = 'gpu slider';

/** An answer of the oEmbed endpoint: JSON, for any site that asks. */
const answer = ( body, status = 200 ) =>
	new Response( typeof body === 'string' ? body : JSON.stringify( body ), {
		status,
		headers: {
			'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=3600',
		},
	} );

const attr = ( text ) =>
	text.replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' ).replace( /</g, '&lt;' );
const unescape = ( text ) =>
	text
		.replace( /&quot;/g, '"' )
		.replace( /&lt;/g, '<' )
		.replace( /&#x27;|&#39;/g, "'" )
		.replace( /&amp;/g, '&' );

/** oEmbed (oembed.com) for the pages of `embeddable()`. */
async function oembed( url, env ) {
	if ( ( url.searchParams.get( 'format' ) || 'json' ) !== 'json' ) {
		return answer( 'Only JSON.', 501 );
	}
	let page;
	try {
		page = new URL( url.searchParams.get( 'url' ) || '' );
	} catch {
		return answer( 'No url, or not one.', 400 );
	}
	page.protocol = 'https:';
	if ( ! page.pathname.endsWith( '/' ) ) {
		page.pathname += '/';
	}
	if ( page.hostname.replace( /^www\./, '' ) !== url.hostname || ! embeddable( page.pathname ) ) {
		return answer( 'Not a page that can be embedded.', 404 );
	}
	page.hostname = url.hostname;
	page.hash = '';
	// The page as it is built: there, with its title and its picture.
	const found = await env.ASSETS.fetch( new URL( page.pathname, url ) );
	if ( found.status !== 200 || ! found.headers.get( 'Content-Type' )?.startsWith( 'text/html' ) ) {
		return answer( 'No such page.', 404 );
	}
	const html = await found.text();
	const title = unescape( html.match( /<title>([^<]*)<\/title>/ )?.[ 1 ] || NAME );
	const picture = html.match( /<meta property="og:image" content="([^"]+)"/ )?.[ 1 ];
	const { width, height } = frame( page.pathname, {
		width: Number( url.searchParams.get( 'maxwidth' ) ),
		height: Number( url.searchParams.get( 'maxheight' ) ),
	} );
	return answer( {
		version: '1.0',
		type: 'rich',
		provider_name: NAME,
		provider_url: `${ url.origin }/`,
		title,
		author_name: 'Niklas Jurij Plessing',
		author_url: 'https://github.com/niklasp',
		width,
		height,
		html: `<iframe src="${ attr( page.href ) }" width="${ width }" height="${ height }" style="border:0;max-width:100%" allow="autoplay; fullscreen" loading="lazy" title="${ attr( title ) }"></iframe>`,
		...( picture && {
			thumbnail_url: picture,
			thumbnail_width: 1200,
			thumbnail_height: 630,
		} ),
		cache_age: 86400,
	} );
}

export default {
	async fetch( request, env ) {
		const url = new URL( request.url );
		if ( url.pathname === '/oembed' || url.pathname === '/oembed/' ) {
			return request.method === 'GET' || request.method === 'HEAD'
				? oembed( url, env )
				: answer( 'GET only.', 405 );
		}
		const accept = request.headers.get( 'Accept' ) || '';
		if ( request.method === 'GET' && /\btext\/markdown\b/.test( accept ) ) {
			const path = url.pathname.endsWith( '/' ) ? url.pathname : `${ url.pathname }/`;
			const found = await env.ASSETS.fetch( new URL( `${ path }index.md`, url ) );
			if ( found.ok ) {
				const text = await found.text();
				return new Response( text, {
					headers: {
						'Content-Type': 'text/markdown; charset=utf-8',
						Vary: 'Accept',
						// As Cloudflare estimates: about four characters a token.
						'x-markdown-tokens': String( Math.ceil( text.length / 4 ) ),
						Link: LINKS,
					},
				} );
			}
		}
		const response = await env.ASSETS.fetch( request );
		if ( ! response.headers.get( 'Content-Type' )?.startsWith( 'text/html' ) ) {
			return response;
		}
		const page = new Response( response.body, response );
		page.headers.append( 'Vary', 'Accept' );
		page.headers.set( 'Link', LINKS );
		return page;
	},
};
