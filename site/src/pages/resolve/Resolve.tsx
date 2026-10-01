import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import 'gpuslider/lightbox.css';
import './resolve.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { lightbox } from 'gpuslider/lightbox';
import { Bar, drawnBy, layer } from '../mount';
import { resolve, WAYS } from './effect';

/**
 * Resolve: rows of pictures that come out of their pixels as they come
 * into view, block by block, and break up again when the page or a row
 * moves fast. After the scroll-revealed gallery of Chakib Mazouni.
 *
 * The pictures are made by `bin/make-dream.mjs`: nothing of them is
 * downloaded.
 */

/** What each of the 24 pictures shows, by the kind of its scene. */
const KINDS = [
	'Blobs of chrome that melt into each other',
	'A sea of liquid metal under a pale sky',
	'Glass spheres over a holographic field',
	'A ring of chrome that twists',
	'Pills of chrome, scattered in the air',
	'Folds of holographic foil',
];

const dream = ( n: number, sizes: string ) => {
	const name = `/media/dream/${ String( n + 1 ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w, ${ name }.jpg 1600w`,
		sizes,
		width: 1600,
		height: 1067,
		alt: KINDS[ n % KINDS.length ],
		'data-gs-full': `${ name }.jpg`,
	};
};

const ALL = Array.from( { length: 24 }, ( _, n ) => n );
const of = ( ...kinds: number[] ) => ALL.filter( ( n ) => kinds.includes( n % 6 ) );

/** The rows, from the top: a name, how they look, which pictures. */
const ROWS = [
	{ name: 'Selected', look: 'hero', sizes: 'min(80vw, 1100px)', pictures: [ 0, 2, 3, 5, 1, 4, 8 ] },
	{ name: 'Chrome', look: 'tall', sizes: 'clamp(220px, 28vw, 420px)', pictures: of( 0, 3, 4 ) },
	{ name: 'Glass and foil', look: 'card', sizes: 'clamp(260px, 38vw, 560px)', pictures: of( 2, 5 ) },
	{ name: 'Metal seas', look: 'wide', sizes: 'min(88vw, 1200px)', pictures: of( 1 ) },
	{ name: 'All of them', look: 'small', sizes: '180px', pictures: ALL },
];

// Which way the pictures come out: read by the effect on every frame.
const MODE = [ 0 ];

export default function Resolve() {
	const page = useRef< HTMLElement >( null );
	const [ by, setBy ] = useState( '' );
	const [ way, setWay ] = useState( 0 );
	// Set by the slider: shows the way chosen from the start again.
	const again = useRef< () => void >( () => {} );

	const choose = ( to: number ) => {
		MODE[ 0 ] = to;
		setWay( to );
		again.current();
	};

	useEffect( () => {
		const root = page.current!;
		const elements = [ ...root.querySelectorAll< HTMLElement >( '.row' ) ];
		// What the effect is told, written on every frame that something
		// moves: how fast the page is scrolled, and for each row how far it
		// has come out of its pixels.
		const speed = [ 0 ];
		const come = elements.map( () => [ 0 ] );
		// Where each row is going: out of its pixels once it is well in view,
		// back into them once it has gone below the screen.
		const wanted = elements.map( () => 0 );
		const aim = () =>
			elements.forEach( ( element, i ) => {
				const { top, bottom } = element.getBoundingClientRect();
				if ( top < innerHeight * 0.88 && bottom > 0 ) {
					wanted[ i ] = 1;
				} else if ( top > innerHeight * 0.97 ) {
					wanted[ i ] = 0;
				}
			} );

		// The screen goes when the pictures of the first row are there and it
		// is drawn; without a canvas, after a while.
		let ready: () => void = () => {};
		const first = new Promise< void >( ( done ) => {
			ready = done;
		} );
		const fallback = setTimeout( () => {
			ready();
			root.classList.add( 'plain' );
		}, 6000 );
		const together = loading( {
			screen: root.querySelector< HTMLElement >( '.gs-loading' )!,
			min: 500,
			also: [ first ],
		} );

		let started = 0;
		const sliders: Slider[] = elements.map( ( element, i ) =>
			createSlider( element, {
				loop: true,
				free: true,
				align: i ? 'start' : 'center',
				plugins: [
					together,
					canvas( {
						effects: [ resolve( { come: come[ i ], speed, mode: MODE } ) ],
						layer: layer(),
						eager: true,
					} ),
					lightbox(),
				],
				on: {
					'canvas:ready': ( name: string ) => {
						setBy( drawnBy( name ) );
						element.classList.add( 'drawn' );
						clearTimeout( fallback );
						if ( ! i ) {
							ready();
						}
					},
					'loading:done': () => {
						if ( ! started ) {
							started = 1;
							root.classList.add( 'shown' );
							run();
						}
					},
				},
			} )
		);

		// One loop for the page, while something moves: the scroll, the speed
		// that settles after it, a row on its way.
		let frame = 0;
		let last = performance.now();
		let was = scrollY;
		let until = 0;
		const tick = ( now: number ) => {
			const dt = Math.min( Math.max( ( now - last ) / 1000, 1 / 240 ), 0.1 );
			last = now;
			const target = Math.min( Math.abs( scrollY - was ) / dt / 4000, 1 );
			was = scrollY;
			// Quick to break up, slow to settle.
			speed[ 0 ] += ( target - speed[ 0 ] ) * ( 1 - Math.exp( -dt * ( target > speed[ 0 ] ? 12 : 3 ) ) );
			let moving = now < until || speed[ 0 ] > 0.002;
			if ( started ) {
				aim();
				come.forEach( ( one, i ) => {
					// In, in about two seconds; out, in one.
					const next = wanted[ i ]
						? Math.min( one[ 0 ] + dt / 2.1, 1 )
						: Math.max( one[ 0 ] - dt / 1.1, 0 );
					if ( next !== one[ 0 ] ) {
						one[ 0 ] = next;
						moving = true;
					}
				} );
			}
			sliders.forEach( ( slider ) => slider.wake() );
			if ( moving ) {
				frame = requestAnimationFrame( tick );
			} else {
				speed[ 0 ] = 0;
				frame = 0;
			}
		};
		const run = () => {
			until = performance.now() + 250;
			if ( ! frame ) {
				last = performance.now();
				frame = requestAnimationFrame( tick );
			}
		};
		// Another way: the rows in view come out again, the new way.
		again.current = () => {
			come.forEach( ( one ) => ( one[ 0 ] = 0 ) );
			run();
		};
		addEventListener( 'scroll', run, { passive: true } );
		addEventListener( 'resize', run );
		Object.assign( window, { sliders } );
		return () => {
			again.current = () => {};
			removeEventListener( 'scroll', run );
			removeEventListener( 'resize', run );
			cancelAnimationFrame( frame );
			clearTimeout( fallback );
			sliders.forEach( ( slider ) => slider.destroy() );
		};
	}, [] );

	return (
		<>
			<header>
				<Bar code="resolve">Resolve{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<div className="ways" role="group" aria-label="How the pictures come out">
				{ WAYS.map( ( one, i ) => (
					<button
						key={ one }
						type="button"
						aria-pressed={ i === way }
						onClick={ () => choose( i ) }
					>
						{ one }
					</button>
				) ) }
			</div>
			<main ref={ page }>
				<div className="gs-loading" role="progressbar" aria-label="Loading the pictures">
					<span data-gs-loaded>0</span>
				</div>
				<section className="intro">
					<h1>Resolve</h1>
					<p>
						Every picture comes out as its row comes into view, part by part, each
						part in its own time. Scroll fast and they break up again; throw a row
						and it does too. The pills at the bottom choose one of five ways. Click a picture to
						open it.
					</p>
				</section>
				{ ROWS.map( ( row, r ) => (
					<section key={ row.name } className={ `set ${ row.look }` }>
						<p className="label">
							<span>{ row.name }</span>
							<span>{ row.pictures.length } pictures</span>
						</p>
						<div className="gs row" aria-label={ `${ row.name }: a row of pictures` }>
							<div className="gs-track">
								{ row.pictures.map( ( n, i ) => (
									<div className="gs-slide" key={ `${ r }-${ i }` }>
										<img
											className="gs-media"
											{ ...dream( n, row.sizes ) }
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
						One effect, <code>resolve()</code>, one shader for all five ways: the
						page tells it which way, how far each row has come out and how fast the
						page is scrolled, the slider how fast the row moves. Pictures made by code.
					</p>
					<p>
						After the{ ' ' }
						<a href="https://tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js/">
							scroll-revealed WebGL gallery
						</a>{ ' ' }
						of Chakib Mazouni on Codrops.
					</p>
				</footer>
			</main>
		</>
	);
}
