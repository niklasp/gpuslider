import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import 'gpuslider/lightbox.css';
import './fold.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading, marquee } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch, type Effect } from 'gpuslider/effects';
import { lightbox } from 'gpuslider/lightbox';
import pictures from '@/lib/wall.json';
import { pinned } from '@/lib/media';
import { Bar, drawnBy, layer } from '../mount';
import { accordion, rise, swell, tunnel, type Told } from './folds';

/**
 * Fold: grids of pictures that fold in 3D as they come into the screen,
 * column after column, and ripple with the speed of the page. Every row of
 * a grid is a slider, which can be dragged and which opens its pictures;
 * the canvas folds what the page lays out flat. After the staggered 3D
 * grid animations of Manoela Ilic.
 */

/** What each of the 24 pictures made by `bin/make-dream.mjs` shows. */
const KINDS = [
	'Blobs of chrome that melt into each other',
	'A sea of liquid metal under a pale sky',
	'Glass spheres over a holographic field',
	'A ring of chrome that twists',
	'Pills of chrome, scattered in the air',
	'Folds of holographic foil',
];

const dream = ( n: number, sizes: string ) => {
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

const wall = ( n: number, sizes: string ) => {
	const one = n % pictures.length;
	return { ...pinned( one, sizes ), alt: `${ pictures[ one ].title }. ${ pictures[ one ].line }` };
};

type Section = {
	id: string;
	name: string;
	line: string;
	fold: ( told: Told ) => Effect;
	pictures: ( n: number, sizes: string ) => Record< string, unknown >;
	/** Rows run this fast, in px a second; every other the other way. */
	speed: number;
};

const SECTIONS: Section[] = [
	{
		id: 'rise',
		name: 'Rise',
		line: 'Cards that lie back on the table and stand up as they come in, one column after the other.',
		fold: ( told ) => rise( told ),
		pictures: dream,
		speed: 16,
	},
	{
		id: 'accordion',
		name: 'Accordion',
		line: 'The rows are folded in pleats, and open flat in the middle of the screen. Scroll faster, and they fold again.',
		fold: ( told ) => accordion( told ),
		pictures: wall,
		speed: -22,
	},
	{
		id: 'swell',
		name: 'Swell',
		line: 'A wave runs through the columns: each picture tips and lifts, as if the grid lay on water.',
		fold: ( told ) => swell( told, { amount: 1.25, lift: 150 } ),
		pictures: dream,
		speed: 20,
	},
	{
		id: 'tunnel',
		name: 'Tunnel',
		line: 'The rows bend round you and the ones above and below lean in. The faster the page, the deeper the tunnel.',
		fold: ( told ) => tunnel( told, { amount: 1.6 } ),
		pictures: wall,
		speed: -18,
	},
];

const ROWS = 3;
const IN_A_ROW = 10;
const SIZES = 'clamp(150px, 22vw, 340px)';

export default function Fold() {
	const page = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const rows = [ ...page.current!.querySelectorAll< HTMLElement >( '.row' ) ];
		// What the page tells the folds: one place for each row, one speed
		// for all of them. Written into on every frame, never replaced.
		const speed = [ 0 ];
		const places = rows.map( () => [ 0 ] );
		const sliders: Slider[] = [];
		const together = loading( { min: 500 } );
		// While a picture is open in the lightbox, nothing runs and nothing folds.
		let open = false;
		const hold = ( still: boolean ) => {
			open = still;
			sliders.forEach( ( one ) =>
				still ? one.plugins.marquee?.pause() : one.plugins.marquee?.play()
			);
		};

		const measure = () => {
			const half = innerHeight / 2;
			rows.forEach( ( row, i ) => {
				const box = row.getBoundingClientRect();
				places[ i ][ 0 ] = ( box.top + box.height / 2 - half ) / half;
			} );
		};
		measure();

		rows.forEach( ( row, i ) => {
			const section = SECTIONS[ Number( row.dataset.section ) ];
			const r = Number( row.dataset.row );
			sliders[ i ] = createSlider( row, {
				loop: true,
				free: true,
				plugins: [
					together,
					marquee( { speed: section.speed * ( r % 2 ? -1 : 1 ) * ( 1 + r * 0.25 ), hover: 0.3 } ),
					canvas( {
						effects: [
							section.fold( { at: places[ i ], speed } ),
							stretch( { amount: 0.35 } ),
						],
						layer: layer(),
						eager: true,
					} ),
					lightbox(),
				],
				on: {
					'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
					'lightbox:open': () => hold( true ),
					'lightbox:close': () => hold( false ),
				},
			} );
		} );

		// The speed of the page, eased: it rises at once and dies away.
		let last = scrollY;
		let then = performance.now();
		let pace = 0;
		let frame = 0;
		const tick = ( now: number ) => {
			const dt = Math.max( 1, now - then ) / 1000;
			then = now;
			const moved = ( scrollY - last ) / dt;
			last = scrollY;
			const target = open ? 0 : Math.max( -1, Math.min( 1, moved / 1800 ) );
			pace += ( target - pace ) * ( 1 - Math.exp( -( Math.abs( target ) > Math.abs( pace ) ? 14 : 2.5 ) * dt ) );
			if ( Math.abs( pace ) < 0.002 && moved === 0 ) {
				pace = 0;
			}
			speed[ 0 ] = pace;
			measure();
			// Only the rows near the screen draw again.
			places.forEach( ( [ y ], i ) => {
				if ( Math.abs( y ) < 1.8 ) {
					sliders[ i ].wake();
				}
			} );
			frame = pace !== 0 ? requestAnimationFrame( tick ) : 0;
		};
		const go = () => {
			if ( ! frame ) {
				then = performance.now();
				frame = requestAnimationFrame( tick );
			}
		};
		addEventListener( 'scroll', go, { passive: true } );
		addEventListener( 'resize', go );
		Object.assign( window, { sliders, folding: { speed, places } } );
		return () => {
			removeEventListener( 'scroll', go );
			removeEventListener( 'resize', go );
			cancelAnimationFrame( frame );
			sliders.forEach( ( slider ) => slider.destroy() );
		};
	}, [] );

	let count = 0;
	return (
		<div ref={ page }>
			<header>
				<Bar code="fold">Fold{ by && ` · drawn by ${ by }` }</Bar>
			</header>

			<div className="intro">
				<h1>Fold</h1>
				<p>
					Grids that fold as they come into the screen, column after column,
					and ripple with how fast you scroll. Every row is a slider: drag
					it, or click a picture to open it.
				</p>
				<p className="hint" aria-hidden="true">
					Scroll
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
					{ Array.from( { length: ROWS }, ( _, r ) => {
						const first = count;
						count += IN_A_ROW;
						return (
							<div
								key={ r }
								className="gs row"
								data-section={ s }
								data-row={ r }
								aria-label={ `${ section.name }: row ${ r + 1 }` }
							>
								<div className="gs-track">
									{ Array.from( { length: IN_A_ROW }, ( __, i ) => (
										<div className="gs-slide" key={ i }>
											<img
												className="gs-media"
												{ ...section.pictures( first + i * 5 + r * 3, SIZES ) }
												draggable={ false }
											/>
										</div>
									) ) }
								</div>
							</div>
						);
					} ) }
				</section>
			) ) }

			<footer>
				<p>
					Every row is a slider with <code>marquee()</code> and{ ' ' }
					<code>lightbox()</code>; the folds are effects of the canvas that the
					page tells where each row is and how fast it scrolls.
				</p>
				<p>
					After{ ' ' }
					<a href="https://tympanus.net/codrops/2024/10/16/staggered-3d-grid-animations-with-scroll-triggered-effects/">
						Staggered 3D Grid Animations
					</a>{ ' ' }
					by Manoela Ilic on Codrops. Pictures made by code.
				</p>
			</footer>
		</div>
	);
}
