/**
 * Opens an issue for every plugin or effect of npm that waits for its
 * review: a package with the keyword `gpuslider-plugin` or
 * `gpuslider-effect` that is not in `site/community.json`, and has no issue
 * yet. An issue that is closed without its package in the list is a no.
 *
 * Run by `.github/workflows/community.yml` every day, with `gh` and a
 * token that may write issues. `--dry` says what it would open.
 *
 *     node bin/community.mjs --dry
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dry = process.argv.includes( '--dry' );
const LABEL = 'plugin review';
const { approved } = JSON.parse(
	readFileSync( new URL( '../site/community.json', import.meta.url ), 'utf8' )
);

const search = async ( keyword ) => {
	const answer = await fetch(
		`https://registry.npmjs.org/-/v1/search?text=keywords:${ keyword }&size=250`
	);
	if ( ! answer.ok ) {
		throw new Error( `npm said ${ answer.status }` );
	}
	return ( await answer.json() ).objects.map( ( found ) => found.package );
};

const gh = ( ...args ) => execFileSync( 'gh', args, { encoding: 'utf8' } );

const found = new Map();
for ( const keyword of [ 'gpuslider-plugin', 'gpuslider-effect' ] ) {
	( await search( keyword ) ).forEach( ( one ) => found.set( one.name, one ) );
}
const waiting = [ ...found.values() ].filter(
	( one ) => ! approved.includes( one.name )
);

if ( ! dry ) {
	gh( 'label', 'create', LABEL, '--color', 'c5def5', '--force', '--description', 'A community plugin to look at' );
}

for ( const one of waiting ) {
	const title = `Plugin review: ${ one.name }`;
	// Open or closed: a package is asked about once.
	const asked = dry
		? []
		: JSON.parse(
				gh( 'issue', 'list', '--state', 'all', '--label', LABEL, '--search', `"${ title }" in:title`, '--json', 'title' )
		  ).filter( ( issue ) => issue.title === title );
	if ( asked.length ) {
		continue;
	}
	const body = [
		`**${ one.name }** ${ one.version }, by ${ one.publisher?.username ?? 'someone' }, has asked to be listed on https://gpuslider.com/docs/community/.`,
		'',
		one.description ? `> ${ one.description }` : '> (no description)',
		'',
		`- npm: ${ one.links.npm }`,
		`- Code: ${ one.links.repository ?? '(none given)' }`,
		`- Homepage: ${ one.links.homepage ?? '(none given)' }`,
		`- Code as it is published: https://www.npmjs.com/package/${ one.name }?activeTab=code`,
		'',
		'To look at: what it does on install (`scripts` in its package.json), what it loads, and whether it does what it says.',
		'',
		`**Yes:** add \`"${ one.name }"\` to \`approved\` in \`site/community.json\`, and this issue is done. **No:** close it; it is not asked again.`,
	].join( '\n' );
	if ( dry ) {
		// eslint-disable-next-line no-console
		console.log( `Would open: ${ title }\n${ body }\n` );
	} else {
		gh( 'issue', 'create', '--title', title, '--label', LABEL, '--body', body );
		// eslint-disable-next-line no-console
		console.log( `Opened: ${ title }` );
	}
}

// eslint-disable-next-line no-console
console.log( `${ found.size } on npm, ${ approved.length } listed, ${ waiting.length } not listed.` );
