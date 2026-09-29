/**
 * What the site says in numbers. None of them is written by hand:
 *
 *     sizes.json       `npm run size`
 *     bench.json       `npm run bench -- --write`
 *     lighthouse.json  `npm run lighthouse`
 */
import sizes from './sizes.json';
import measured from './bench.json';
import scores from './lighthouse.json';

export const parts: Record< string, number > = sizes.parts;
export const files: Record< string, number > = sizes.dist;

/** Bytes as KB, as the README says them. */
export const kb = ( bytes: number ) => ( bytes / 1024 ).toFixed( 1 );

const of = ( kind: string ) =>
	Object.keys( parts )
		.filter( ( name ) => name.startsWith( `${ kind }: ` ) )
		.map( ( name ) => parts[ name ] );

/** How many there are of a kind: 'plugin', 'effect', 'transition'. */
export const count = ( kind: string ) => of( kind ).length;

/** From the smallest of a kind to the largest, in KB. */
export const range = ( kind: string ) =>
	`${ kb( Math.min( ...of( kind ) ) ) } to ${ kb( Math.max( ...of( kind ) ) ) }`;

export type Layer = 'gl' | 'gpu';

type Until = { effects: string; layer: string; first: number; second: number };
type Moving = {
	sliders: number;
	effects: string;
	layer: string;
	canvases: number;
	rest?: number;
	script: number;
	late: number;
	frames: number;
};

/** The sliders of the benchmark have these effects. */
const EFFECTS = 'stretch,waves';

export const bench = {
	date: measured.date,
	machine: measured.machine,
	density: measured.density,
	runs: measured.runs,
	browsers: measured.browsers.map( ( { name, version, until, moving } ) => ( {
		name: name.replace( / \(.*/, '' ),
		version: version.split( '.' )[ 0 ],
		/** Until a slider is drawn: the first of a page, and one after it. */
		until: ( layer: Layer ) =>
			( until as Until[] ).find(
				( one ) => one.layer === layer && one.effects === EFFECTS
			)!,
		/** While so many sliders move. */
		moving: ( layer: Layer, sliders: number ) =>
			( moving as Moving[] ).find(
				( one ) =>
					one.layer === layer &&
					one.sliders === sliders &&
					one.effects === EFFECTS
			)!,
	} ) ),
};

type Score = Record< string, number >;

/** What Lighthouse said of a page of the site, if it was asked. */
export const lighthouse = ( page: string ) =>
	( scores.pages as Record< string, { mobile: Score; desktop: Score } > )[
		page
	];

/** The day Lighthouse was asked. */
export const asked: string | null = scores.date;
