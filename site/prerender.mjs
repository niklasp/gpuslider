/**
 * After the build: writes every page into its file in `dist/` as HTML.
 *
 * - The markup of the page, rendered by React on the server.
 * - The styles in the document: no request for them before the first
 *   paint.
 * - The script after what the first paint needs.
 * - What search engines and the pages that show a link read: the address
 *   that is the page's own, a picture and a description for a shared
 *   link, the facts as JSON-LD; and `sitemap.xml`, `robots.txt` and
 *   `llms-full.txt` for all of them.
 *
 * The address of the site is `SITE_URL`, or the one below.
 *
 * `npm run build` does this.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve( import.meta.dirname, 'dist' );
const { render, pages } = await import(
	pathToFileURL( resolve( dist, 'server/entry-server.js' ) ).href
);

const escape = ( text ) =>
	text.replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' ).replace( /</g, '&lt;' );
const unescape = ( text ) =>
	text
		.replace( /&quot;/g, '"' )
		.replace( /&lt;/g, '<' )
		.replace( /&#x27;|&#39;/g, "'" )
		.replace( /&amp;/g, '&' );

const ORIGIN = ( process.env.SITE_URL || 'https://gpuslider.com' ).replace( /\/$/, '' );
const NAME = 'gpu slider';
const REPO = 'https://github.com/niklasp/gpuslider';

// The picture of a shared link: the page, taken by `og.mjs`.
const picture = ( path ) =>
	path.match( /^\/(?:examples\/)?([a-z]+)\// )?.[ 1 ] || 'home';

/** What is in the head for search engines and shared links. */
function head( path, title, description ) {
	const url = ORIGIN + path;
	const doc = path.startsWith( '/docs/' );
	const site = { '@type': 'WebSite', '@id': `${ ORIGIN }/#site`, name: NAME, url: `${ ORIGIN }/` };
	const facts = path === '/'
		? [
				site,
				{
					'@type': 'SoftwareSourceCode',
					name: NAME,
					description,
					url,
					codeRepository: REPO,
					programmingLanguage: [ 'JavaScript', 'GLSL', 'WGSL' ],
					runtimePlatform: 'Web browser (WebGPU, WebGL 2)',
					license: 'https://opensource.org/licenses/MIT',
				},
		  ]
		: [
				{
					'@type': doc ? 'TechArticle' : 'WebPage',
					...( doc ? { headline: title.split( ' · ' )[ 0 ] } : { name: title } ),
					description,
					url,
					isPartOf: { '@id': site[ '@id' ] },
				},
				{
					'@type': 'BreadcrumbList',
					itemListElement: path
						.split( '/' )
						.filter( Boolean )
						.map( ( part, i, parts ) => ( {
							'@type': 'ListItem',
							position: i + 1,
							name: i === parts.length - 1 ? title.split( ' · ' )[ 0 ] : part[ 0 ].toUpperCase() + part.slice( 1 ),
							item: `${ ORIGIN }/${ parts.slice( 0, i + 1 ).join( '/' ) }/`,
						} ) ),
				},
		  ];
	const image = `${ ORIGIN }/og/${ picture( path ) }.jpg`;
	const attr = ( text ) => escape( text );
	return [
		`<link rel="canonical" href="${ url }" />`,
		`<meta property="og:type" content="${ doc ? 'article' : 'website' }" />`,
		`<meta property="og:site_name" content="${ NAME }" />`,
		`<meta property="og:title" content="${ attr( title ) }" />`,
		`<meta property="og:description" content="${ attr( description ) }" />`,
		`<meta property="og:url" content="${ url }" />`,
		`<meta property="og:image" content="${ image }" />`,
		'<meta property="og:image:width" content="1200" />',
		'<meta property="og:image:height" content="630" />',
		`<meta property="og:image:alt" content="${ attr( title ) }" />`,
		'<meta name="twitter:card" content="summary_large_image" />',
		'<link rel="alternate" type="text/plain" href="/llms.txt" title="For language models" />',
		`<script type="application/ld+json">${ JSON.stringify( {
			'@context': 'https://schema.org',
			'@graph': facts,
		} ).replace( /</g, '\\u003c' ) }</script>`,
	].join( '\n\t\t' );
}
// The pages that are to be found: in the sitemap.
const found = [];
// What each of them says of itself: for its Markdown.
const said = {};

// What Vite has built, before anything is written into it: some files
// are what several pages are made of.
const built = {};
for ( const [ page, { from = page } ] of Object.entries( pages ) ) {
	built[ from ] ||= readFileSync( resolve( dist, from ), 'utf8' );
}

for ( const [ page, { from = page, title, description } ] of Object.entries(
	pages
) ) {
	let html = built[ from ];
	if ( title ) {
		html = html
			.replace( /<title>[^<]*<\/title>/, `<title>${ escape( title ) }</title>` )
			.replace(
				/(<meta name="description" content=")[^"]*"/,
				`$1${ escape( description ) }"`
			);
	}
	// The address of the page, and what it says of itself.
	const path = `/${ page.replace( /index\.html$/, '' ) }`;
	const hidden = html.includes( 'content="noindex"' );
	if ( ! hidden ) {
		const title = unescape( html.match( /<title>([^<]*)<\/title>/ )[ 1 ] );
		const about = unescape(
			html.match( /<meta\s+name="description"\s+content="([^"]*)"/ )[ 1 ]
		);
		html = html.replace( '</head>', () => `\t${ head( path, title, about ) }\n\t</head>` );
		found.push( path );
		said[ path ] = { title, about };
	}

	const markup = await render( page );
	// As a function: what is in the markup is not a pattern.
	html = html.replace(
		'<div id="root"></div>',
		() => `<div id="root">${ markup }</div>`
	);

	// The styles of the page itself after the ones it shares with other
	// pages, the library's and Tailwind: as the page imports them. The
	// build puts them first, and then the rules of the library that are
	// as specific win over the page's.
	const own = `/assets/${ from.replace( /\.html$/, '' ).replaceAll( '/', '-' ) }-`;
	const sheets = html.match( /<link rel="stylesheet"[^>]*>/g ) || [];
	const mine = sheets.find( ( sheet ) => sheet.includes( own ) );
	if ( mine && mine !== sheets.at( -1 ) ) {
		html = html
			.replace( mine, '' )
			.replace( sheets.at( -1 ), () => sheets.at( -1 ) + mine );
	}

	// Styles into the document.
	html = html.replace(
		/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g,
		( _, file ) =>
			`<style>${ readFileSync( resolve( dist, file ), 'utf8' ).replaceAll(
				'url(/assets/',
				'url(/assets/'
			) }</style>`
	);

	// The page is there without its script, so the script gives way to what
	// the first paint shows: the image and the font.
	//
	// Hints that ask for the font or for the script of the controls with the
	// document were tried and taken out again: on a slow connection they take
	// from the document and the first image what these need more (first paint
	// 1.8 s with them, 1.4 s without, measured by Lighthouse).
	html = html
		.replace(
			'<script type="module"',
			'<script type="module" fetchpriority="low"'
		)
		// What the script shares with the scripts of the other pages: it
		// gives way as the script does.
		.replaceAll(
			'<link rel="modulepreload"',
			'<link rel="modulepreload" fetchpriority="low"'
		);

	mkdirSync( dirname( resolve( dist, page ) ), { recursive: true } );
	writeFileSync( resolve( dist, page ), html );
	// eslint-disable-next-line no-console
	console.log( `dist/${ page }: ${ Math.round( html.length / 1024 ) } KB with the page in it` );
}
rmSync( resolve( dist, 'server' ), { recursive: true } );

// For search engines: the pages, and where the list of them is.
const day = new Date().toISOString().slice( 0, 10 );
writeFileSync(
	resolve( dist, 'sitemap.xml' ),
	`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ found
	.map( ( path ) => `\t<url><loc>${ ORIGIN }${ path }</loc><lastmod>${ day }</lastmod></url>` )
	.join( '\n' ) }
</urlset>
`
);
writeFileSync(
	resolve( dist, 'robots.txt' ),
	`${ readFileSync( resolve( dist, 'robots.txt' ), 'utf8' ).trim() }\n\nSitemap: ${ ORIGIN }/sitemap.xml\n`
);
// For language models: all the docs in one file, as DOCS.md has them.
writeFileSync(
	resolve( dist, 'llms-full.txt' ),
	readFileSync( resolve( import.meta.dirname, '../DOCS.md' ), 'utf8' )
);
// For agents that ask for Markdown (the Worker gives it to them): the docs
// have theirs from the docs plugin; the first page is llms.txt, the others
// what they say of themselves and where the docs are.
const llms = readFileSync( resolve( dist, 'llms.txt' ), 'utf8' );
for ( const path of found ) {
	const file = resolve( dist, `${ path.slice( 1 ) }index.md` );
	if ( existsSync( file ) ) {
		continue;
	}
	const { title, about } = said[ path ];
	writeFileSync(
		file,
		path === '/'
			? llms
			: `# ${ title }\n\n${ about }\n\nThe page is interactive; what it shows is in the docs: ${ ORIGIN }/llms.txt\n`
	);
}

// For agents: the skill of the repo, and the index that finds it.
const skill = readFileSync( resolve( import.meta.dirname, '../skills/gpuslider/SKILL.md' ), 'utf8' );
const skills = resolve( dist, '.well-known/agent-skills' );
mkdirSync( resolve( skills, 'gpuslider' ), { recursive: true } );
writeFileSync( resolve( skills, 'gpuslider/SKILL.md' ), skill );
writeFileSync(
	resolve( skills, 'index.json' ),
	`${ JSON.stringify(
		{
			$schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
			skills: [
				{
					name: 'gpuslider',
					type: 'skill-md',
					description: skill.match( /^description: (.+)$/m )[ 1 ],
					url: '/.well-known/agent-skills/gpuslider/SKILL.md',
					digest: `sha256:${ createHash( 'sha256' ).update( skill ).digest( 'hex' ) }`,
				},
			],
		},
		null,
		'\t'
	) }\n`
);
// eslint-disable-next-line no-console
console.log( `dist/sitemap.xml: ${ found.length } pages, for ${ ORIGIN }` );
