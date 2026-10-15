/**
 * What the film is: the photos one after the other, each held for a
 * while, and a transition between each two. Pure: the preview and the
 * export ask it the same question, what is seen at a time, and get the
 * same answer.
 */
import {
	blocks,
	burn,
	choose,
	chroma,
	datamosh,
	displace,
	distance,
	fluted,
	fold,
	glitch,
	glyphs,
	kaleido,
	lens,
	lightning,
	liquid,
	mosaic,
	pixelate,
	push,
	ripple,
	signal,
	swirl,
	warp,
	weave,
	wind,
	zoom,
	type Effect,
} from 'gpuslider/effects';

/** All the transitions of the library, by the name they are shown with. */
export const TRANSITIONS: [ string, () => Effect ][] = [
	[ 'Liquid', liquid ],
	[ 'Burn', burn ],
	[ 'Lightning', lightning ],
	[ 'Glitch', glitch ],
	[ 'Swirl', swirl ],
	[ 'Warp', warp ],
	[ 'Zoom', zoom ],
	[ 'Push', push ],
	[ 'Ripple', ripple ],
	[ 'Pixelate', pixelate ],
	[ 'Lens', lens ],
	[ 'Fluted', fluted ],
	[ 'Mosaic', mosaic ],
	[ 'Blocks', blocks ],
	[ 'Fold', fold ],
	[ 'Signal', signal ],
	[ 'Chroma', chroma ],
	[ 'Kaleido', kaleido ],
	[ 'Displace', displace ],
	[ 'Datamosh', datamosh ],
	[ 'Wind', wind ],
	[ 'Distance', distance ],
	[ 'Glyphs', glyphs ],
	[ 'Weave', weave ],
];

/** All of them in one shader, of which `pick( i )` draws one. */
export const allInOne = () => choose( TRANSITIONS.map( ( [ , make ] ) => make() ) );

/** `mix`: another transition at every cut. */
export type Choice = number | 'mix';

/** The sizes of a film. */
export const FORMATS = {
	'9:16': { width: 1080, height: 1920, label: '9:16', note: 'Reels, TikTok, Shorts' },
	'1:1': { width: 1080, height: 1080, label: '1:1', note: 'Feed' },
	'16:9': { width: 1920, height: 1080, label: '16:9', note: 'YouTube' },
} as const;

export type Format = keyof typeof FORMATS;

export interface Plan {
	/** How many photos. */
	count: number;
	/** Seconds a photo is held, still. */
	hold: number;
	/** Seconds a transition takes. */
	turn: number;
	choice: Choice;
	/** For `mix`: the order of the transitions, by their index. */
	order: number[];
}

/** One transition after the other, the first few the ones to show off. */
export const ORDER = [ 0, 2, 1, 4, 22, 3, 5, 23, 11, 6, 12, 8, 16, 7, 9, 10, 13, 14, 15, 17, 18, 19, 20, 21 ];

/** The whole film, s. */
export const length = ( { count, hold, turn }: Plan ) =>
	count > 0 ? count * hold + Math.max( 0, count - 1 ) * turn : 0;

/**
 * A move that begins and ends slowly and takes all of its time: the
 * change is spread over the whole transition, not done in its first
 * quarter as a spring would.
 *
 * @param u 0 to 1.
 * @return 0 to 1.
 */
export const ease = ( u: number ) =>
	u < 0.5 ? 4 * u * u * u : 1 - Math.pow( -2 * u + 2, 3 ) / 2;

/** What is seen at a time. */
export interface Moment {
	from: number;
	to: number;
	/** Of the transition, eased: 0 is `from`. */
	progress: number;
	/** Index of the transition in `TRANSITIONS`. */
	which: number;
}

/** The transition of a cut. */
export const transitionOf = ( plan: Plan, cut: number ) =>
	plan.choice === 'mix' ? plan.order[ cut % plan.order.length ] : plan.choice;

/**
 * @param plan The film.
 * @param t Time, s.
 * @return What is seen then.
 */
export function at( plan: Plan, t: number ): Moment {
	const { count, hold, turn } = plan;
	const step = hold + turn;
	const last = Math.max( 0, count - 1 );
	const k = Math.min( last, Math.max( 0, Math.floor( t / step ) ) );
	const into = t - k * step - hold;
	if ( k >= last || into <= 0 ) {
		return { from: k, to: k, progress: 0, which: transitionOf( plan, k ) };
	}
	return {
		from: k,
		to: k + 1,
		progress: ease( Math.min( 1, into / turn ) ),
		which: transitionOf( plan, k ),
	};
}
