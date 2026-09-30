/**
 * The docs of the site are the README of the library, cut into pages:
 * what is said about the library is said in one place.
 *
 * A plugin of Vite. It reads `../README.md` when the site is built or
 * served, and gives the site
 *
 *     virtual:docs          the pages: their names, what they are about,
 *                           their headings; and pieces of code for the
 *                           first page
 *     virtual:docs/<page>   a page as HTML
 *
 * A page names the parts of the README it is made of by their headings.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import type { Plugin } from 'vite';

const README = path.resolve( import.meta.dirname, '../README.md' );

type Part =
	| string
	| {
			/** The heading in the README. */
			part: string;
			/** The heading on the page, where it is another. */
			as?: string;
			/** Without its heading: the page has it as its title. */
			bare?: boolean;
	  };

type Doc = {
	/** The address: /docs/<slug>/, and /docs/ for the first. */
	slug: string;
	title: string;
	/** What the page is about, in a sentence or two. */
	lead: string;
	/** Markdown before the parts. */
	before?: string;
	parts: Part[];
};

export const DOCS: Doc[] = [
	{
		slug: '',
		title: 'Get started',
		lead: 'A slider in a page: what to import, what to write, and what a visitor gets who has no script or no canvas.',
		before: `gpu slider is not on npm yet. Until it is, \`npm run size\` in the repo builds \`dist/\`: the files for pages without a bundler.

## The markup

A slider is an element with a track in it, and the slides are the children of the track. What is drawn on the canvas has the class \`gs-media\`; what is in \`gs-content\` stays HTML on top of it.

\`\`\`html
<div class="gs" aria-label="Photos">
	<div class="gs-track">
		<div class="gs-slide">
			<img class="gs-media" src="one.jpg" alt="…">
			<div class="gs-content">Anything: headings, links, buttons.</div>
		</div>
		<div class="gs-slide">
			<video class="gs-media" src="two.mp4" muted playsinline loop autoplay></video>
		</div>
	</div>
</div>
\`\`\`
`,
		parts: [
			'With what you name, and no more',
			'With all options',
			'Three tiers',
		],
	},
	{
		slug: 'html',
		title: 'Without a script',
		lead: 'One file, and attributes in the HTML. For pages that have no bundler, and for people who write no script.',
		parts: [
			{ part: 'Without a script of your own', bare: true },
			'Buttons anywhere',
		],
	},
	{
		slug: 'react',
		title: 'React',
		lead: 'Two components, and a hook for markup of your own. React renders the slides, the library moves them.',
		parts: [ { part: 'In React', bare: true } ],
	},
	{
		slug: 'layout',
		title: 'Layout',
		lead: 'How many slides are in view, how far they are apart, which way they go: all of it is CSS, and the script measures what the page lays out.',
		parts: [ { part: 'Layout is CSS', bare: true }, 'Focus point' ],
	},
	{
		slug: 'options',
		title: 'Options, API and events',
		lead: 'What a slider is given, what it can be asked, and what it says.',
		parts: [ 'Options', 'API', 'Events' ],
	},
	{
		slug: 'plugins',
		title: 'Plugins',
		lead: 'The core moves slides. Arrows, keys, autoplay, a ticker, thumbnails and all else are plugins: the ones that come with it, and the ones you write.',
		parts: [
			{ part: 'Plugins that come with it', as: 'That come with it' },
			{ part: 'Plugins', as: 'Your own' },
		],
	},
	{
		slug: 'canvas',
		title: 'The canvas',
		lead: 'What draws the media: WebGPU where the browser has it, WebGL 2 where not. And what the two were measured at.',
		parts: [ { part: 'The canvas', bare: true } ],
	},
	{
		slug: 'effects',
		title: 'Effects and transitions',
		lead: 'What the canvas does to the media while the slider moves, while the pointer is over it, and while one slide turns into the next. And how to write one.',
		parts: [ { part: 'Effects', bare: true } ],
	},
	{
		slug: 'lightbox',
		title: 'Lightbox',
		lead: 'A click on a slide lets its image grow to the screen.',
		parts: [ { part: 'Lightbox', bare: true } ],
	},
	{
		slug: 'loading',
		title: 'Loading',
		lead: 'A screen while the media load, and events that say how far they are.',
		parts: [ { part: 'Loading', bare: true } ],
	},
	{
		slug: 'extending',
		title: 'Extending',
		lead: 'Plugins, effects, and slides placed by a script: what to take for what, and how they go with the lightbox. With a list for agents.',
		parts: [ { part: 'Extending', bare: true } ],
	},
	{
		slug: 'size',
		title: 'Size, and what is not there yet',
		lead: 'What each part costs in the bundle of who imports it. And what the library does not do, said as plainly as what it does.',
		parts: [ 'Size', 'Not yet' ],
	},
];

/** The name of a page in `virtual:docs/<name>`. */
const nameOf = ( { slug }: Doc ) => slug || 'start';
const addressOf = ( { slug }: Doc ) => ( slug ? `/docs/${ slug }/` : '/docs/' );

const idOf = ( text: string ) =>
	text
		.toLowerCase()
		.replace( /`/g, '' )
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-|-$/g, '' );

const escape = ( text: string ) =>
	text.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );

/*
 * Colours for code, as little as tells a comment from a string from the
 * rest. Each rule has four groups: comment, string, word, number.
 */
const SCRIPT =
	/(\/\/.*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(import|from|export|const|let|function|return|if|else|new|for|of|in|get|default|await|async|true|false|null)\b|\b(\d[\d.]*)\b/g;
const RULES: Record< string, RegExp > = {
	js: SCRIPT,
	jsx: SCRIPT,
	css: /(\/\*[\s\S]*?\*\/)|("[^"\n]*"|'[^'\n]*')|(@[\w-]+|--[\w-]+)|\b(\d[\d.]*(?:px|vh|vw|fr|deg|%|s|ms)?)/g,
	html: /(<!--[\s\S]*?-->)|("[^"]*"|'[^']*')|(<\/?[\w-]+|\/?>)|\b([\w-]+)(?==)/g,
	sh: /(#.*)|("[^"\n]*"|'[^'\n]*')|^(npm|node|npx)\b|()/gm,
};

export function highlight( code: string, lang = '' ) {
	const rule = RULES[ lang ];
	if ( ! rule ) {
		return escape( code );
	}
	let html = '';
	let at = 0;
	for ( const found of code.matchAll( rule ) ) {
		if ( ! found[ 0 ] ) {
			continue;
		}
		const kind = [ 'c', 's', 'k', 'n' ][
			found.slice( 1 ).findIndex( ( group ) => group !== undefined )
		];
		html +=
			escape( code.slice( at, found.index ) ) +
			`<span class="${ kind }">${ escape( found[ 0 ] ) }</span>`;
		at = found.index + found[ 0 ].length;
	}
	return html + escape( code.slice( at ) );
}

type Section = { level: number; title: string; lines: string[] };

/** The README as its headings of the second and third level. */
function sections( text: string ): Section[] {
	const all: Section[] = [];
	let fenced = false;
	for ( const line of text.split( '\n' ) ) {
		if ( line.startsWith( '```' ) ) {
			fenced = ! fenced;
		}
		const heading = ! fenced && /^(#{2,3}) (.+)$/.exec( line );
		if ( heading ) {
			all.push( { level: heading[ 1 ].length, title: heading[ 2 ], lines: [] } );
		} else {
			all.at( -1 )?.lines.push( line );
		}
	}
	return all;
}

/** Everything the site is given, made of the README as it is now. */
function read() {
	const all = sections( readFileSync( README, 'utf8' ) );
	/** Where a heading of the README is on the site. */
	const places: Record< string, string > = {};

	const markdown = DOCS.map( ( doc ) => {
		let text = doc.before || '';
		for ( const given of doc.parts ) {
			const { part, as = undefined, bare = false } =
				typeof given === 'string' ? { part: given } : given;
			const from = all.findIndex( ( { title } ) => title === part );
			if ( from < 0 ) {
				throw new Error(
					`The docs ask for "${ part }", and the README has no such heading.`
				);
			}
			const top = all[ from ].level;
			// A heading of the page is of the second level.
			const shift = top - ( bare ? 1 : 2 );
			for ( let i = from; i < all.length; i++ ) {
				const { level, title, lines } = all[ i ];
				if ( i > from && level <= top ) {
					break;
				}
				const shown = i === from && as ? as : title;
				if ( i === from && bare ) {
					places[ idOf( title ) ] = addressOf( doc );
				} else {
					places[ idOf( title ) ] = `${ addressOf( doc ) }#${ idOf( shown ) }`;
					text += `\n${ '#'.repeat( level - shift ) } ${ shown }\n`;
				}
				text += lines.join( '\n' ) + '\n';
			}
		}
		return text;
	} );

	const html = ( text: string, doc?: Doc ) => {
		const headings: { id: string; text: string }[] = [];
		const marked = new Marked( {
			renderer: {
				heading( { tokens, depth } ) {
					const inner = this.parser.parseInline( tokens );
					const id = idOf( inner.replace( /<[^>]+>/g, '' ) );
					if ( depth === 2 ) {
						headings.push( { id, text: inner } );
					}
					return `<h${ depth } id="${ id }"><a href="#${ id }">${ inner }</a></h${ depth }>\n`;
				},
				code( { text: code, lang } ) {
					return `<pre data-lang="${ lang || '' }"><code>${ highlight(
						code,
						lang
					) }</code></pre>\n`;
				},
				table( token ) {
					const cell = ( tag: string, { tokens }: ( typeof token.header )[ 0 ] ) =>
						`<${ tag }>${ this.parser.parseInline( tokens ) }</${ tag.split( ' ' )[ 0 ] }>`;
					// A table without words in its head has no head.
					const head = token.header.some( ( { text: said } ) => said.trim() )
						? `<thead><tr>${ token.header
								.map( ( one ) => cell( 'th', one ) )
								.join( '' ) }</tr></thead>`
						: '';
					return `<div class="scrolls" tabindex="0" role="group" aria-label="Table"><table>${ head }<tbody>${ token.rows
						.map(
							( row ) =>
								// What a row is about is in its first cell.
								`<tr>${ row
									.map( ( one, i ) => cell( i ? 'td' : 'th scope="row"', one ) )
									.join( '' ) }</tr>`
						)
						.join( '' ) }</tbody></table></div>\n`;
				},
				link( { href, tokens } ) {
					const inner = this.parser.parseInline( tokens );
					// To a heading of the README: to where it is on the site.
					let to = href.startsWith( '#' ) ? places[ href.slice( 1 ) ] : href;
					if ( ! to ) {
						throw new Error(
							`The README links to "${ href }", which is on no page of the docs.`
						);
					}
					if ( doc && to.startsWith( `${ addressOf( doc ) }#` ) ) {
						to = to.slice( addressOf( doc ).length );
					}
					return `<a href="${ to }">${ inner }</a>`;
				},
			},
		} );
		return { html: marked.parse( text ) as string, headings };
	};

	const pages = DOCS.map( ( doc, i ) => ( {
		...html( markdown[ i ], doc ),
		name: nameOf( doc ),
		slug: doc.slug,
		address: addressOf( doc ),
		title: doc.title,
		lead: doc.lead,
	} ) );

	/** The first piece of code under a heading. */
	const code = ( title: string ) => {
		const found = all.find( ( one ) => one.title === title );
		const [ , lang, text ] =
			/```(\w*)\n([\s\S]*?)\n```/.exec( found?.lines.join( '\n' ) || '' ) || [];
		if ( ! text ) {
			throw new Error( `No code under "${ title }" in the README.` );
		}
		return highlight( text, lang );
	};

	return {
		pages,
		code: {
			script: code( 'With what you name, and no more' ),
			canvas: code( 'With all options' ),
			react: code( 'In React' ),
			html: code( 'Without a script of your own' ),
		},
	};
}

const ID = 'virtual:docs';

export function docs(): Plugin {
	return {
		name: 'docs',
		resolveId( id ) {
			return id === ID || id.startsWith( `${ ID }/` ) ? `\0${ id }` : null;
		},
		load( id ) {
			if ( ! id.startsWith( `\0${ ID }` ) ) {
				return null;
			}
			this.addWatchFile( README );
			const { pages, code } = read();
			const name = id.slice( ID.length + 2 );
			if ( name ) {
				const page = pages.find( ( one ) => one.name === name );
				return `export default ${ JSON.stringify( page?.html || '' ) };`;
			}
			return [
				`export const pages = ${ JSON.stringify(
					pages.map( ( { html: _, ...page } ) => page )
				) };`,
				`export const code = ${ JSON.stringify( code ) };`,
				`export const load = {`,
				...pages.map(
					( page ) =>
						`	${ JSON.stringify( page.slug ) }: () => import( '${ ID }/${
							page.name
						}' ),`
				),
				`};`,
			].join( '\n' );
		},
		// The README has changed: the pages that are made of it are others.
		handleHotUpdate( { file, server } ) {
			if ( file === README ) {
				for ( const [ id, module ] of server.moduleGraph.idToModuleMap ) {
					if ( id.startsWith( `\0${ ID }` ) ) {
						server.moduleGraph.invalidateModule( module );
					}
				}
				server.ws.send( { type: 'full-reload' } );
				return [];
			}
		},
		// Every page of the docs is made of one file.
		configureServer( server ) {
			server.middlewares.use( ( request, _, next ) => {
				const [ address, query ] = ( request.url || '' ).split( '?' );
				if (
					DOCS.some(
						( doc ) => doc.slug && addressOf( doc ) === address
					)
				) {
					request.url = `/docs/index.html${ query ? `?${ query }` : '' }`;
				}
				next();
			} );
		},
	};
}
