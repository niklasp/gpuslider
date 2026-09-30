/**
 * The media of the site: photos from Pexels, in the widths a page should
 * offer. Or, chosen at the top of the page, the colour fields that
 * `npm run media` generates in the repo, in their place.
 */
import { useSyncExternalStore, type CSSProperties } from 'react';
import type { Create } from 'gpuslider';

/** What the pictures of the site are: colour fields, or photos. */
export type Kind = 'fields' | 'photos';

const KEY = 'gs-media';
// Photos, unless the visitor chose the colour fields.
let kind: Kind = 'photos';
try {
	kind = localStorage.getItem( KEY ) === 'fields' ? 'fields' : 'photos';
} catch {}
const hearing = new Set< () => void >();

/** The pictures the visitor has chosen. */
export const useKind = () =>
	useSyncExternalStore(
		( heard ) => {
			hearing.add( heard );
			return () => hearing.delete( heard );
		},
		() => kind,
		// The page as it is prerendered.
		(): Kind => 'photos'
	);

/** Chooses the pictures of the site, and keeps them for the next visit. */
export function choose( to: Kind ) {
	kind = to;
	try {
		localStorage.setItem( KEY, to );
	} catch {}
	hearing.forEach( ( heard ) => heard() );
}

/**
 * The photo in the place of an image or a film: one for each of the eight,
 * and one for the film that moves. What each shows, what it is lit by, and
 * the point of it that stays in view when it is cut. From Pexels, 1600 px
 * wide, as p1 to p9: photos 18671362, 8112576, 6835833, 5767690, 11584969,
 * 11439378, 39688121, 983200 and 37127322 of pexels.com/photo/.
 */
const PHOTOS: Record<
	number,
	{ alt: string; light: string; focus: string; tall?: boolean; high?: number }
> = {
	1: { alt: 'The silhouette of a man with a guitar in front of laser rays', light: '#5a4df0', focus: '45% 45%' },
	2: { alt: 'A man kneeling by a boombox in front of neon signs', light: '#3f6df2', focus: '55% 45%' },
	3: { alt: 'A woman in sunglasses between neon letters', light: '#16c8c0', focus: '45% 35%' },
	4: { alt: 'A couple in an arcade, looking at the camera', light: '#9a4cf5', focus: '72% 40%' },
	5: { alt: 'A woman in a white top, lightning projected on her', light: '#3d5cff', focus: '50% 35%' },
	6: { alt: 'A man with words projected in red on his face', light: '#f0304f', focus: '55% 40%', tall: true },
	7: { alt: 'A woman laughing in blue light, a stripe of warm light over her face', light: '#2a3cf0', focus: '50% 30%', tall: true },
	8: { alt: 'Bark of a tree beside lava that has cooled, still glowing in its cracks', light: '#ff4a12', focus: '60% 50%', high: 900 },
	9: { alt: 'A lagoon at dusk, a bare tree and the last of the sun mirrored in the water', light: '#e8703a', focus: '45% 40%', high: 1072 },
};

// Which photo is in the place of which: each its own, so no slider has
// one twice.
const PLACE: Record< number | 'a' | 'b', number > = {
	1: 3, 2: 1, 3: 6, 4: 4, 5: 5, 6: 2, 7: 8, 8: 7, a: 5, b: 9,
};

export const photo = ( n: number | 'a' | 'b' ) => PHOTOS[ PLACE[ n ] ];

/** Width and height of every image as it was made. */
const SIZES: Record< number, [ number, number ] > = {
	1: [ 1600, 900 ],
	2: [ 1600, 1200 ],
	3: [ 1200, 1600 ],
	4: [ 1600, 900 ],
	5: [ 1400, 1400 ],
	6: [ 1600, 1000 ],
	7: [ 1600, 700 ],
	8: [ 1200, 1500 ],
};

const WIDTHS = [ 480, 720, 960, 1600 ];

/**
 * The colour of every picture and film: what is most of all itself in it,
 * taken from the pictures, for the light a slide casts on the page.
 */
export const LIGHT: Record< number | 'a' | 'b', string > = {
	1: '#f35c6d',
	2: '#03bbf2',
	3: '#71f0cb',
	4: '#e54fb8',
	5: '#eaba34',
	6: '#8a6cf0',
	7: '#9ace5c',
	8: '#e0929e',
	a: '#6a3cf5',
	b: '#c0608f',
};

/** The light of a picture or film, of the pictures chosen. */
export const lightOf = ( n: number | 'a' | 'b', of: Kind ) =>
	of === 'photos' ? photo( n ).light : LIGHT[ n ];

/**
 * What an `<img>` needs to load the right file and keep its place; of a
 * photo, in the pictures that are photos, and of a film its photo.
 */
export function image( n: number | 'a' | 'b', of: Kind = 'fields' ) {
	if ( of === 'photos' ) {
		const name = `p${ PLACE[ n ] }`;
		return {
			src: `/media/${ name }-960.avif`,
			srcSet: WIDTHS.map(
				( to ) => `/media/${ name }-${ to }.avif ${ to }w`
			).join( ', ' ),
			// Most are wide, 3 : 2; two are tall, 2 : 3.
			width: 1600,
			height: photo( n ).high ?? ( photo( n ).tall ? 2400 : 1067 ),
			style: { '--gs-focus': photo( n ).focus } as CSSProperties,
		};
	}
	const [ width, height ] = SIZES[ n as number ];
	return {
		src: `/media/${ n }-960.avif`,
		srcSet: WIDTHS.map(
			( to ) => `/media/${ n }-${ to }.avif ${ Math.min( to, width ) }w`
		).join( ', ' ),
		width,
		height,
	};
}

/**
 * What an `<img>` needs for picture `n` of the wall (from 0), drawn at
 * `sizes`: AVIF, 420 or 840 wide.
 */
export const pinned = ( n: number, sizes: string ) => {
	const name = `/media/wall/${ String( n + 1 ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w`,
		sizes,
		width: 840,
		height: 560,
	};
};

/**
 * What is in the film `a`: video 13794727 of Pexels, cut to a loop by
 * `bin/make-film.mjs`. It is the film whatever the pictures are.
 */
export const FILM = 'Someone walking into a tunnel of coloured lights';

/**
 * The films: `a` the one of Pexels, `b` a colour field that moves, high,
 * and `c` one that is wide, which is a film whatever the pictures are.
 */
export type Film = 'a' | 'b' | 'c';

/**
 * Whether there is a film of that name in the pictures chosen: `b` is a
 * colour field that moves, and a photo where the pictures are photos.
 */
export const filmed = ( name: Film, of: Kind = 'fields' ) =>
	of === 'fields' || name !== 'b';

/** What a `<video>` needs. */
/** Whether the visitor has asked for less motion. */
const still = () => matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/**
 * A plugin after `autoplay()`: where less motion is asked for, it waits
 * until the visitor lets it play.
 */
export const calm = (): Create => ( slider ) => {
	if ( still() ) {
		slider.plugins.autoplay?.pause();
	}
};

/**
 * For the `ref` of a film that plays by itself. Its `autoplay` is given by
 * the script, not by the HTML: in the HTML the browser loads the whole
 * film before the page is there, whatever `preload` says. It is loaded
 * once the page is; and where motion is to be reduced, it stays a poster.
 */
export const film = ( el: HTMLVideoElement | null ) => {
	if ( ! el || still() ) {
		return;
	}
	el.autoplay = true;
	const load = () => ( el.preload = 'auto' );
	if ( document.readyState === 'complete' ) {
		load();
	} else {
		addEventListener( 'load', load, { once: true } );
	}
};

export const video = ( name: Film ) => {
	const file = { a: 'film', b: 'b', c: 'a' }[ name ];
	return {
		src: `/media/${ file }.mp4`,
		poster: `/media/${ file }-poster.avif`,
		...{
			a: { width: 960, height: 540 },
			b: { width: 960, height: 1200 },
			c: { width: 1280, height: 720 },
		}[ name ],
	};
};
