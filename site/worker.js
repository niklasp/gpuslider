/**
 * In front of the files of `dist/`, for pages only (see `wrangler.jsonc`):
 *
 * - A request that accepts text/markdown gets the page as Markdown, where
 *   the build wrote one beside its HTML (`index.md`).
 * - The HTML says where agents find more, in `Link` headers, and that it
 *   varies with `Accept`.
 */
const LINKS = [
	'</llms.txt>; rel="describedby"; type="text/plain"',
	'</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
	'</docs/>; rel="service-doc"',
].join( ', ' );

export default {
	async fetch( request, env ) {
		const url = new URL( request.url );
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
