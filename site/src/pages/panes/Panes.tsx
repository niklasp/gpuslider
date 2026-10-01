import { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/funnel-display';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import 'gpuslider/lightbox.css';
import './panes.css';
import { createSlider, type Slider } from 'gpuslider';
import { autoplay, keyboard, loading, panes } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import {
	burn,
	choose as among,
	edges,
	sweep,
	glyphs,
	lightning,
	liquid,
	pixelate,
	ripple,
	swirl,
	warp,
	weave,
	wind,
} from 'gpuslider/effects';
import { lightbox } from 'gpuslider/lightbox';
import pictures from '@/lib/wall.json';
import { image, photo } from '@/lib/media';
import { Bar, drawnBy, layer, share, shared } from '../mount';

/**
 * Panes: a gallery of four pictures that turn into the next four by a
 * transition of the canvas, in three ways: place by place (`panes()`), all
 * at once as one picture (`panes()` and `sweep()`), or at the edges of a
 * row that moves (`edges()`). Below it a row of three that burn into the
 * next at random.
 */

// The transitions to choose from, by the name in the dock and the link.
const WAYS = [
	[ 'Liquid', liquid() ],
	[ 'Burn', burn() ],
	[ 'Glyphs', glyphs() ],
	[ 'Weave', weave() ],
	[ 'Lightning', lightning() ],
	[ 'Swirl', swirl() ],
	[ 'Pixelate', pixelate() ],
	[ 'Warp', warp() ],
	[ 'Wind', wind() ],
	[ 'Ripple', ripple() ],
] as const;
const NAMES = WAYS.map( ( [ name ] ) => name );

// The orders the places turn in, as the plugin names them.
const ORDERS = [
	[ 'start', 'From the left' ],
	[ 'center', 'From the middle' ],
	[ 'random', 'At random' ],
	[ 'end', 'From the right' ],
] as const;
const ORDER_NAMES = ORDERS.map( ( [ name ] ) => name );
type Order = ( typeof ORDER_NAMES )[ number ];

// The three ways several pictures in view turn into the next ones: each
// place after another (`panes()`), all of them as one picture (`panes()`
// and `sweep()`), or a row that moves, whose pictures come and go by the
// transition at the ends of the view (`edges()`).
const MODES = [
	[ 'panes', 'Place by place' ],
	[ 'sweep', 'One sweep' ],
	[ 'edges', 'At the edges' ],
] as const;
const MODE_NAMES = MODES.map( ( [ name ] ) => name );
type Mode = ( typeof MODE_NAMES )[ number ];

// Slides per view to choose from.
const PER = [ 1, 2, 3, 4, 5, 6 ] as const;

// The photos, p1 to p9, and the pictures made by code: one of each in
// turn, so that every view has both.
const PHOTOS = [ 2, 6, 1, 4, 5, 3, 8, 7, 'b' ] as const;
const KINDS = [
	'Blobs of chrome that melt into each other',
	'A sea of liquid metal under a pale sky',
	'Glass spheres over a holographic field',
	'A ring of chrome that twists',
	'Pills of chrome, scattered in the air',
	'Folds of holographic foil',
];

type Picture = Record< string, unknown > & { alt: string };

const picture = ( n: number, sizes: string ): Picture => {
	if ( n % 2 === 0 ) {
		const one = PHOTOS[ ( n / 2 ) % PHOTOS.length ];
		return { ...image( one, 'photos' ), sizes, alt: photo( one ).alt };
	}
	const name = `/media/dream/${ String( ( ( n * 7 ) % 24 ) + 1 ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w`,
		sizes,
		width: 840,
		height: 560,
		alt: KINDS[ n % KINDS.length ],
	};
};

// Four places, six views.
const FOUR = Array.from( { length: 24 }, ( _, n ) => n );
// Three places, five views.
const THREE = Array.from( { length: 15 }, ( _, n ) => n + 5 );

export default function Panes() {
	const gallery = useRef< HTMLDivElement >( null );
	const row = useRef< HTMLDivElement >( null );
	const strip = useRef< HTMLDivElement >( null );
	const slider = useRef< Slider | null >( null );
	const turn = useRef< ReturnType< typeof among > | null >( null );
	const [ by, setBy ] = useState( '' );
	const [ way, setWay ] = useState( 0 );
	const [ order, setOrder ] = useState< Order >( 'start' );
	const [ mode, setMode ] = useState< Mode >( 'panes' );
	// Slides per view, from the range under the gallery; none: as the CSS
	// says, four, and two on a phone.
	const [ per, setPer ] = useState< number | null >( null );
	// What a link says, read before the gallery is made.
	const [ read, setRead ] = useState( false );
	// What the CSS says while nobody has chosen.
	const [ fallback, setFallback ] = useState( 4 );
	const wayAt = useRef( 0 );
	const orderAt = useRef< Order >( 'start' );

	const pick = ( to: number ) => {
		wayAt.current = to;
		turn.current?.pick( to );
		setWay( to );
		share( 'way', to ? NAMES[ to ] : undefined );
		// On a phone the dock is a strip: bring the chosen one into it.
		const pill = strip.current?.children[ to ] as HTMLElement | undefined;
		const along = strip.current;
		if ( along && pill && along.scrollWidth > along.clientWidth ) {
			along.scrollTo( {
				left: pill.offsetLeft - ( along.clientWidth - pill.offsetWidth ) / 2,
				behavior: 'smooth',
			} );
		}
	};

	const arrange = ( to: Order ) => {
		orderAt.current = to;
		const made = slider.current?.plugins.panes;
		if ( made ) {
			made.order = to;
		}
		setOrder( to );
		share( 'order', to === 'start' ? undefined : to );
	};

	const space = ( to: number ) => {
		setPer( to );
		share( 'per', to );
	};

	const turnInto = ( to: Mode ) => {
		setMode( to );
		share( 'mode', to === 'panes' ? undefined : to );
	};

	// A link can carry the transition, the order and the mode:
	// ?way=weave&order=center&mode=sweep. The build renders the first ones.
	useEffect( () => {
		const start = shared( 'way', NAMES );
		if ( start ) {
			pick( NAMES.indexOf( start ) );
		}
		const first = shared( 'order', ORDER_NAMES );
		if ( first ) {
			arrange( first );
		}
		setMode( shared( 'mode', MODE_NAMES ) || 'panes' );
		setFallback( matchMedia( '(max-width: 760px)' ).matches ? 2 : 4 );
		const many = shared( 'per', PER.map( String ) );
		if ( many ) {
			setPer( Number( many ) );
		}
		setRead( true );
	}, [] );

	// The gallery, made again for each mode.
	useEffect( () => {
		if ( ! read ) {
			return;
		}
		turn.current = among( WAYS.map( ( [ , effect ] ) => effect ), wayAt.current );
		const moves = {
			'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
			// At the edges a name goes with its picture, as far as the
			// transition has taken it: by how much of it is out.
			frame: ( { places }: { places: { share: number }[] } ) => {
				if ( mode === 'edges' ) {
					names.forEach( ( name, i ) =>
						name.style.setProperty( '--gs-near', String( places[ i ].share ) )
					);
				}
			},
		};
		const names = [ ...gallery.current!.querySelectorAll< HTMLElement >( '.gs-content' ) ];
		const made =
			mode === 'edges'
				? createSlider( gallery.current!, {
						loop: true,
						align: 'center',
						// Slow, to see the slides come and go.
						duration: 1700,
						plugins: [
							loading(),
							keyboard(),
							autoplay( 3200 ),
							canvas( { effects: [ edges( turn.current ) ], layer: layer() } ),
							lightbox(),
						],
						on: moves,
				  } )
				: createSlider( gallery.current!, {
						loop: true,
						duration: mode === 'sweep' ? 900 : 950,
						// Every place has as long to turn as the others.
						ease: ( u ) => u,
						plugins: [
							panes( { order: orderAt.current, stagger: mode === 'sweep' ? 0 : 0.42 } ),
							loading(),
							keyboard(),
							autoplay( 3600 ),
							canvas( {
								effects: [ mode === 'sweep' ? sweep( turn.current ) : turn.current ],
								layer: layer(),
							} ),
							lightbox(),
						],
						on: moves,
				  } );
		slider.current = made;
		Object.assign( window, { slider: made } );
		return () => {
			made.destroy();
			names.forEach( ( name ) => name.style.removeProperty( '--gs-near' ) );
		};
	}, [ mode, read ] );

	// Slides per view, without a slider made again: the slider measures
	// again when its slides change their size. At the edges a fraction
	// more, to have pictures cut by both ends.
	useEffect( () => {
		const style = gallery.current!.style;
		if ( per === null ) {
			style.removeProperty( '--gs-per-view' );
		} else {
			style.setProperty( '--gs-per-view', String( mode === 'edges' ? Math.max( 1.4, per - 0.6 ) : per ) );
		}
	}, [ per, mode ] );

	// Three, at random.
	useEffect( () => {
		const three = createSlider( row.current!, {
			loop: true,
			duration: 1050,
			ease: ( u ) => u,
			plugins: [
				panes( { order: 'random', stagger: 0.5 } ),
				loading(),
				autoplay( 2800 ),
				canvas( { effects: [ burn() ], layer: layer() } ),
				lightbox(),
			],
		} );
		Object.assign( window, { three } );
		return () => three.destroy();
	}, [] );

	return (
		<>
			<header>
				<Bar code="panes">Panes{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<main>
				<section className="intro">
					<h1>Panes</h1>
					<p>
						Several pictures in view, and three ways for them to turn into the
						next ones by a transition of the canvas: place by place, all at once
						in one sweep, or at the edges of a row that moves.
					</p>
				</section>

				<div className="stage">
					<div ref={ gallery } className="gs gallery" data-mode={ mode } aria-label="Gallery">
						<div className="gs-track">
							{ FOUR.map( ( n ) => (
								<div className="gs-slide" key={ n }>
									<img
										className="gs-media"
										{ ...picture( n, per ? `${ Math.ceil( 100 / per ) }vw` : '(max-width: 760px) 50vw, 25vw' ) }
										draggable={ false }
									/>
									<div className="gs-content">
										<span>{ String( n + 1 ).padStart( 2, '0' ) }</span>
										{ pictures[ n % pictures.length ].title }
									</div>
								</div>
							) ) }
						</div>
					</div>
					<button
						type="button"
						className="side prev"
						aria-label="Previous pictures"
						onClick={ () => slider.current?.prev() }
					>
						<span aria-hidden="true" />
					</button>
					<button
						type="button"
						className="side next"
						aria-label="Next pictures"
						onClick={ () => slider.current?.next() }
					>
						<span aria-hidden="true" />
					</button>
				</div>

				<div className="deck">
					<label className="per">
						<span>Per view</span>
						<input
							type="range"
							min={ PER[ 0 ] }
							max={ PER[ PER.length - 1 ] }
							step={ 1 }
							value={ per ?? fallback }
							onChange={ ( event ) => space( Number( event.target.value ) ) }
						/>
						<output>{ per ?? fallback }</output>
					</label>
					<div className="dock">
						<div className="pills modes" role="group" aria-label="Mode">
							{ MODES.map( ( [ name, label ] ) => (
								<button
									key={ name }
									type="button"
									aria-pressed={ name === mode }
									onClick={ () => turnInto( name ) }
								>
									{ label }
								</button>
							) ) }
						</div>
						<div ref={ strip } className="pills" role="group" aria-label="Transition">
							{ NAMES.map( ( name, i ) => (
								<button
									key={ name }
									type="button"
									aria-pressed={ i === way }
									onClick={ () => pick( i ) }
								>
									{ name }
								</button>
							) ) }
						</div>
						<div className="pills orders" role="group" aria-label="Order" hidden={ mode !== 'panes' }>
							{ ORDERS.map( ( [ name, label ] ) => (
								<button
									key={ name }
									type="button"
									aria-pressed={ name === order }
									onClick={ () => arrange( name ) }
								>
									{ label }
								</button>
							) ) }
						</div>
					</div>
				</div>

				<section className="second">
					<h2>Three, at random</h2>
					<p>The same plugin, three places, burning into the next in an order of their own each time.</p>
				</section>
				<div ref={ row } className="gs row" aria-label="Three at a time, at random">
					<div className="gs-track">
						{ THREE.map( ( n ) => (
							<div className="gs-slide" key={ n }>
								<img
									className="gs-media"
									{ ...picture( n, '(max-width: 760px) 50vw, 33vw' ) }
									draggable={ false }
								/>
							</div>
						) ) }
					</div>
				</div>
			</main>
			<footer>
				<p>
					Each gallery is one slider with several slides in view. Place by
					place, the plugin <code>panes()</code> keeps the slides where they
					are, and a move turns each place into its next with the transition
					of the canvas, any of the twenty-four, place after place. In one
					sweep, <code>sweep()</code> lays the transition over the whole view
					and every place draws its part of it. At the edges, the effect{ ' ' }
					<code>edges()</code> lets a row move as ever and has its pictures go
					and come by the transition where they cross the ends of the view.
					Drag, use the arrow keys, or click a picture to open it.
				</p>
				<p>Photos from Pexels; the other pictures are made by code.</p>
			</footer>
		</>
	);
}
