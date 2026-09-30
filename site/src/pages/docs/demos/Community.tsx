import { useEffect, useState } from 'react';
import { approved } from '../../../../community.json';

/** A package of npm, as its search gives it. */
type Found = {
	package: {
		name: string;
		version: string;
		description?: string;
		keywords?: string[];
		date: string;
		publisher?: { username: string };
		links: { npm: string; homepage?: string; repository?: string };
	};
};

/** A link of a package: anyone can publish one, so only to the web. */
const web = ( url?: string ) => ( url && /^https?:\/\//.test( url ) ? url : undefined );

/** What npm has with a keyword, newest first. */
const search = async ( keyword: string ) => {
	const answer = await fetch(
		`https://registry.npmjs.org/-/v1/search?text=keywords:${ keyword }&size=250`
	);
	if ( ! answer.ok ) {
		throw new Error( `npm said ${ answer.status }` );
	}
	return ( ( await answer.json() ) as { objects: Found[] } ).objects;
};

/**
 * The plugins and effects of others that have been looked at: the packages
 * of npm with the keyword `gpuslider-plugin` or `gpuslider-effect` whose
 * names are in `community.json`. What npm says of them is asked for in the
 * browser, so their versions are the newest. A package that is not in the
 * list yet waits for its review (see `bin/community.mjs`).
 */
export default function Community() {
	const [ found, setFound ] = useState< Found[] | null >( null );
	const [ failed, setFailed ] = useState( false );

	useEffect( () => {
		Promise.all( [ search( 'gpuslider-plugin' ), search( 'gpuslider-effect' ) ] )
			.then( ( lists ) => {
				// A package with both keywords once.
				const seen = new Map< string, Found >();
				lists
					.flat()
					.filter( ( one ) => ( approved as string[] ).includes( one.package.name ) )
					.forEach( ( one ) => seen.set( one.package.name, one ) );
				setFound(
					[ ...seen.values() ].sort(
						( a, b ) => Date.parse( b.package.date ) - Date.parse( a.package.date )
					)
				);
			} )
			.catch( () => setFailed( true ) );
	}, [] );

	if ( failed ) {
		return (
			<p className="note">
				npm did not answer, so the list cannot be shown. Try again in a
				moment.
			</p>
		);
	}
	if ( ! found ) {
		return <p className="note">Asking npm…</p>;
	}
	if ( ! found.length ) {
		return (
			<p className="note">
				No plugins listed yet. Be the first: publish yours with the
				keyword <code>gpuslider-plugin</code>, as below, and it is here
				after a short review.
			</p>
		);
	}
	return (
		<ul data-testid="community" className="grid gap-4 sm:grid-cols-2">
			{ found.map( ( { package: one } ) => (
				<li key={ one.name } className="frost sq-tile grid content-start gap-2 p-5">
					<p className="flex flex-wrap items-baseline gap-x-2">
						<a className="font-mono font-medium" href={ one.links.npm }>
							{ one.name }
						</a>
						<span className="text-xs text-muted-foreground">{ one.version }</span>
						{ one.keywords?.includes( 'gpuslider-effect' ) && (
							<span className="text-xs text-muted-foreground">effect</span>
						) }
					</p>
					{ one.description && (
						<p className="text-sm text-foreground/75">{ one.description }</p>
					) }
					<p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
						{ one.publisher && <span>by { one.publisher.username }</span> }
						{ web( one.links.homepage ) && (
							<a href={ web( one.links.homepage ) } rel="nofollow ugc">
								Homepage
							</a>
						) }
						{ web( one.links.repository ) && (
							<a href={ web( one.links.repository ) } rel="nofollow ugc">
								Code
							</a>
						) }
					</p>
				</li>
			) ) }
		</ul>
	);
}
