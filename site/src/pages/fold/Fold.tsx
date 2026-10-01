import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import 'gpuslider/lightbox.css';
import './fold.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import type { Effect } from 'gpuslider/effects';
import { lightbox } from 'gpuslider/lightbox';
import pictures from '@/lib/wall.json';
import { image, photo, pinned } from '@/lib/media';
import { Bar, drawnBy, layer } from '../mount';
import { bloom, cascade, rain, turn, type Told } from './folds';

/**
 * Fold: four walls of small pictures, whose pictures the canvas folds one
 * after another as a wall comes into the screen, each wall in its own
 * order, and folds away again as it leaves. Where a wall is decides how
 * far, so it can be scrolled either way and stopped anywhere. A wall is
 * one slider: its track is a grid of rows, which the slider measures as
 * it is, so that one canvas draws the whole wall, and it can be dragged
 * sideways without an end. After the staggered 3D grid animations of
 * Manoela Ilic.
 */

// The photos, each once: p1 to p9.
const PHOTOS = [ 2, 6, 1, 4, 5, 3, 8, 7, 'b' ] as const;

/** What each of the 24 pictures made by `bin/make-dream.mjs` shows. */
const KINDS = [
	'Blobs of chrome that melt into each other',
	'A sea of liquid metal under a pale sky',
	'Glass spheres over a holographic field',
	'A ring of chrome that twists',
	'Pills of chrome, scattered in the air',
	'Folds of holographic foil',
];

type Picture = Record< string, unknown > & { alt: string };

const fromPhoto = ( n: number, sizes: string ): Picture => {
	const one = PHOTOS[ n % PHOTOS.length ];
	return { ...image( one, 'photos' ), sizes, alt: photo( one ).alt };
};
const fromDream = ( n: number, sizes: string ): Picture => {
	const name = `/media/dream/${ String( ( n % 24 ) + 1 ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w`,
		sizes,
		width: 840,
		height: 560,
		alt: KINDS[ n % KINDS.length ],
	};
};
const fromWall = ( n: number, sizes: string ): Picture => {
	const one = n % pictures.length;
	return { ...pinned( one, sizes ), alt: `${ pictures[ one ].title }. ${ pictures[ one ].line }` };
};

type Section = {
	id: string;
	name: string;
	line: string;
	fold: ( told: Told ) => Effect;
	/** The picture at a place of the wall. */
	picture: ( n: number, sizes: string ) => Picture;
};

// Photos and pictures made by code, in turn.
const mixed = ( other: typeof fromDream ) => ( n: number, sizes: string ) =>
	n % 3 === 1 ? other( n * 5, sizes ) : fromPhoto( n, sizes );

const SECTIONS: Section[] = [
	{
		id: 'turn',
		name: 'Turn',
		line: 'Column after column, from the left, every picture turns on its axis to face you, and turns away again as the wall leaves.',
		fold: turn,
		picture: mixed( fromDream ),
	},
	{
		id: 'cascade',
		name: 'Cascade',
		line: 'Along the diagonal the pictures come spinning out of the depth, small, and grow into their places.',
		fold: cascade,
		picture: mixed( fromWall ),
	},
	{
		id: 'bloom',
		name: 'Bloom',
		line: 'From the middle out, the pictures rise from far away, tipped from the middle, and lie flat as they arrive.',
		fold: bloom,
		picture: mixed( fromDream ),
	},
	{
		id: 'rain',
		name: 'Rain',
		line: 'In an order that seems no order, every picture swings down on its top edge like a card let fall.',
		fold: rain,
		picture: mixed( fromWall ),
	},
];

// Pictures in a wall: rows times columns, enough columns for a wall that
// is wider than the screen and runs on without an end; the CSS says how
// many rows. Each is a small texture to decode when the wall comes back
// into view.
const IN_A_WALL = 48;
// Small, as they are drawn: what is decoded smaller is decoded sooner.
const SIZES = '(max-width: 700px) 27vw, 9vw';

export default function Fold() {
	const page = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const walls = [ ...page.current!.querySelectorAll< HTMLElement >( '.wall' ) ];
		// Where each wall is on the screen, written into, never replaced.
		const tops = walls.map( () => [ innerHeight, innerHeight ] );
		// Where each wall is on the page: measured when the page changes
		// size, not while it scrolls.
		let at = walls.map( () => 0 );
		const measure = () => {
			at = walls.map( ( wall ) => wall.getBoundingClientRect().top + scrollY );
		};
		measure();

		let open = false;
		const together = loading( { min: 500 } );
		const sliders: Slider[] = walls.map( ( wall, i ) =>
			createSlider( wall, {
				loop: true,
				free: true,
				align: 'center',
				plugins: [
					together,
					canvas( {
						effects: [ SECTIONS[ i ].fold( { top: tops[ i ] } ) ],
						layer: layer(),
						density: 1.5,
					} ),
					lightbox( { slider: { loop: true } } ),
				],
				on: {
					'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
					'lightbox:open': () => {
						open = true;
					},
					'lightbox:close': () => {
						open = false;
					},
				},
			} )
		);

		// Where the page is scrolled, eased a little: a turn of the wheel
		// is a jump, which the pictures follow smoothly.
		let shown = scrollY;
		let then = 0;
		let frame = 0;
		const tick = ( now: number ) => {
			const dt = Math.min( 0.05, Math.max( 0.001, ( now - then ) / 1000 ) );
			then = now;
			shown += ( scrollY - shown ) * ( 1 - Math.exp( -14 * dt ) );
			const still = Math.abs( scrollY - shown ) < 0.5;
			if ( still ) {
				shown = scrollY;
			}
			const high = innerHeight;
			walls.forEach( ( wall, i ) => {
				const top = at[ i ] - shown;
				tops[ i ][ 0 ] = top;
				tops[ i ][ 1 ] = high;
				// Only the walls on the screen draw again.
				if ( ! open && top < high * 1.2 && top + wall.offsetHeight > -high * 0.2 ) {
					sliders[ i ].wake();
				}
			} );
			frame = still ? 0 : requestAnimationFrame( tick );
		};
		const go = () => {
			if ( ! frame ) {
				then = performance.now() - 16;
				frame = requestAnimationFrame( tick );
			}
		};
		const resize = () => {
			measure();
			go();
		};
		addEventListener( 'scroll', go, { passive: true } );
		addEventListener( 'resize', resize );
		Object.assign( window, { sliders, folding: { tops } } );
		go();
		return () => {
			removeEventListener( 'scroll', go );
			removeEventListener( 'resize', resize );
			cancelAnimationFrame( frame );
			sliders.forEach( ( slider ) => slider.destroy() );
		};
	}, [] );

	return (
		<div ref={ page }>
			<header>
				<Bar code="fold">Fold{ by && ` · drawn by ${ by }` }</Bar>
			</header>

			<div className="intro">
				<h1>Fold</h1>
				<p>
					Walls of small pictures that fold into place one after another as
					you scroll, each wall in its own order, and fold away as they leave.
					Drag a wall sideways; click a picture to open it.
				</p>
			</div>

			{ SECTIONS.map( ( section, s ) => (
				<section key={ section.id } id={ section.id } aria-labelledby={ `${ section.id }-name` }>
					<div className="said">
						<span className="step">
							{ s + 1 } / { SECTIONS.length }
						</span>
						<h2 id={ `${ section.id }-name` }>{ section.name }</h2>
						<p>{ section.line }</p>
					</div>
					<div className="gs wall" aria-label={ `${ section.name }: a wall of pictures` }>
						<div className="gs-track">
							{ Array.from( { length: IN_A_WALL }, ( _, i ) => (
								<div className="gs-slide" key={ i }>
									<img
										className="gs-media"
										{ ...section.picture( i + s * 7, SIZES ) }
										draggable={ false }
									/>
								</div>
							) ) }
						</div>
					</div>
				</section>
			) ) }

			<footer>
				<p>
					Every wall is one slider whose track is a grid, drawn by one canvas;
					the folds are effects that the page tells where the wall is.
				</p>
				<p>
					After{ ' ' }
					<a href="https://tympanus.net/codrops/2024/10/16/staggered-3d-grid-animations-with-scroll-triggered-effects/">
						Staggered 3D Grid Animations
					</a>{ ' ' }
					by Manoela Ilic on Codrops. Photos from Pexels, and pictures made by
					code.
				</p>
			</footer>
		</div>
	);
}
