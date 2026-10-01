import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import 'gpuslider/lightbox.css';
import './orbit.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch } from 'gpuslider/effects';
import { lightbox } from 'gpuslider/lightbox';
import { Bar, drawnBy, layer } from '../mount';
import { cylinder, write, type Shape } from './cylinder';

/**
 * Orbit: one row of pictures, rolled up into a cylinder that the page
 * turns as it is scrolled, and that a drag throws round. Scrolled further,
 * the cylinder tips, takes the visitor inside, and unrolls into the row it
 * always was. After the On-Scroll 3D Carousel of Manoela Ilic.
 *
 * Two sliders of the same pictures: the cylinder, and below it its
 * reflection. The page moves both by the same distance in every frame.
 * The pictures are made by `bin/make-dream.mjs`.
 */

const PICTURES = [ 1, 3, 4, 6, 8, 10, 12, 14, 16, 19, 21, 23 ];
const ABOUT = [
	'Blobs of chrome that melt into each other',
	'Glass spheres over a holographic field',
	'A ring of chrome that twists',
	'Folds of holographic foil',
	'A sea of liquid metal under a pale sky',
	'Pills of chrome, scattered in the air',
];

const dream = ( n: number ) => {
	const name = `/media/dream/${ String( n ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w, ${ name }.jpg 1600w`,
		sizes: '(max-width: 700px) 50vw, 30vw',
		width: 1600,
		height: 1067,
	};
};

/** The chapters of the page, and the shape of the cylinder in each. */
const CHAPTERS: { title: string; line: string; shape: Shape; tall?: Partial< Shape > }[] = [
	{
		title: 'Orbit',
		line: 'Twelve pictures on a cylinder. Scroll, and it turns; scroll up, and it turns back. Drag it to throw it round, and click the one in front to open it.',
		shape: { k: 1.1, tilt: 0.3, roll: 0, y: 0.02, push: 1.15, inner: 0, flat: 0, floor: 0.035 },
		tall: { k: 1.55, tilt: 0.42, y: -0.02 },
	},
	{
		title: 'Tilt',
		line: 'The same cylinder, seen from higher up and leaning, as a ring around a planet. What is behind sinks into the dark, what is in front leans with the speed.',
		shape: { k: 0.95, tilt: 0.56, roll: -0.24, y: 0.1, push: 1.3, inner: 0, flat: 0, floor: 0.05 },
		tall: { k: 1.45, roll: -0.2 },
	},
	{
		title: 'Inside',
		line: 'Step in. The near half is gone, and the far wall curves round you: the pictures you saw from behind, the right way round.',
		shape: { k: 2.1, tilt: 0.1, roll: 0, y: 0.0, push: 0.05, inner: 1, flat: 0, floor: 0.04 },
		tall: { k: 3, tilt: 0.16 },
	},
	{
		title: 'Unrolled',
		line: 'It was a slider all along: one row of <img> tags, which an effect of the canvas rolls up into a cylinder. A second slider of the same pictures is its reflection.',
		shape: { k: 1, tilt: 0, roll: 0, y: -0.04, push: 1, inner: 0, flat: 1, floor: 0.03 },
	},
];

// How fast it turns by itself, px per second of the row; and how much of
// the speed the page is scrolled with turns it.
const DRIFT = 26;
const SCROLL = 0.55;

const shapeOf = ( i: number, tall: boolean ): Shape => ( {
	...CHAPTERS[ i ].shape,
	...( tall ? CHAPTERS[ i ].tall : {} ),
} );

/** The shape between two chapters: `t` from 0, the first, to one less than their number. */
const between = ( t: number, tall: boolean ): Shape => {
	const i = Math.max( 0, Math.min( CHAPTERS.length - 2, Math.floor( t ) ) );
	const u = Math.max( 0, Math.min( 1, t - i ) );
	// Each chapter holds its shape for a while before it gives way.
	const e = u < 0.25 ? 0 : u > 0.75 ? 1 : ( ( u - 0.25 ) / 0.5 ) ** 2 * ( 3 - 2 * ( ( u - 0.25 ) / 0.5 ) );
	const a = shapeOf( i, tall );
	const b = shapeOf( i + 1, tall );
	const out = {} as Shape;
	( Object.keys( a ) as ( keyof Shape )[] ).forEach( ( key ) => {
		out[ key ] = a[ key ] + ( b[ key ] - a[ key ] ) * e;
	} );
	return out;
};

export default function Orbit() {
	const stage = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const root = stage.current!;
		const win = window;
		const period = [ win.innerWidth * 2.2 ];
		const shape = [ 0, 0, 0, 0 ];
		const more = [ 0, 0, 0, 0 ];
		const tall = () => win.innerWidth < win.innerHeight * 0.8;
		write( between( 0, tall() ), shape, more );

		let drawn = 0;
		let ready: () => void = () => {};
		const canvases = new Promise< void >( ( done ) => {
			ready = done;
		} );
		const fallback = setTimeout( ready, 6000 );
		const together = loading( {
			screen: root.querySelector< HTMLElement >( '.gs-loading' )!,
			min: 500,
			also: [ canvases ],
		} );
		const perspective = Math.round( Math.max( 1400, win.innerWidth * 1.15 ) );
		// The reflection first: the cylinder is drawn over it.
		const [ mirror, ring ] = [ 1, 0 ].map( ( m ) =>
			createSlider( root.querySelector< HTMLElement >( m ? '.mirror' : '.ring' )!, {
				loop: true,
				free: true,
				drag: false,
				plugins: [
					together,
					canvas( {
						effects: [
							stretch( { amount: 0.45 } ),
							cylinder( { period, shape, more, mirror: m } ),
						],
						layer: layer(),
						eager: true,
						perspective,
					} ),
					...( m ? [] : [ lightbox( { punch: 0.3 } ) ] ),
				],
				on: {
					'canvas:ready': ( name: string ) => {
						setBy( drawnBy( name ) );
						if ( ++drawn === 2 ) {
							ready();
						}
					},
					'loading:done': () => root.classList.add( 'shown' ),
				},
			} )
		) as Slider[];

		const measure = () => {
			const [ one, two ] = ring.slides as HTMLElement[];
			period[ 0 ] = ( two.offsetLeft - one.offsetLeft ) * ring.slides.length;
			ring.wake();
			mirror.wake();
		};
		const seen = new ResizeObserver( measure );
		seen.observe( root );

		// Both move by the same distance, in the same frame.
		const move = ( by: number ) => {
			ring.shift( by, true );
			mirror.shift( by, true );
		};

		// The shape follows the page; the turning follows the scrolling, the
		// drag and a slow drift of its own, which goes the way the page was
		// last scrolled.
		const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
		let open = false;
		let way = 1;
		let spin = 0;
		let thrown = 0;
		let was = win.scrollY;
		let pace = 0;
		let last = 0;
		let frame = 0;
		let held: { x: number; at: number; v: number; moved: number } | null = null;
		const tick = ( now: number ) => {
			frame = requestAnimationFrame( tick );
			const dt = Math.min( 0.05, last ? ( now - last ) / 1000 : 0 );
			last = now;
			if ( ! dt ) {
				return;
			}
			const y = win.scrollY;
			pace += ( ( y - was ) / dt - pace ) * ( 1 - Math.exp( -6 * dt ) );
			was = y;
			if ( Math.abs( pace ) > 40 ) {
				way = Math.sign( pace );
			}
			const top = Math.max( 1, document.documentElement.scrollHeight - win.innerHeight );
			write( between( ( y / top ) * ( CHAPTERS.length - 1 ), tall() ), shape, more );
			const goal = open ? 0 : ( still.matches ? 0 : DRIFT * way ) + pace * SCROLL;
			spin += ( goal - spin ) * ( 1 - Math.exp( -3 * dt ) );
			thrown *= Math.exp( -1.6 * dt );
			if ( ! held && ! open ) {
				move( ( spin + thrown ) * dt );
			} else {
				ring.wake();
				mirror.wake();
			}
		};
		frame = requestAnimationFrame( tick );

		// A drag turns it; let go, it goes on and slows down. A short one is
		// a click: the picture seen there opens.
		const down = ( event: PointerEvent ) => {
			if ( open || event.button > 0 || ( event.target as HTMLElement ).closest( 'a, .chapter p, .chapter h2' ) ) {
				return;
			}
			held = { x: event.clientX, at: event.timeStamp, v: 0, moved: 0 };
			thrown = 0;
		};
		const drag = ( event: PointerEvent ) => {
			if ( ! held ) {
				hover( event );
				return;
			}
			const dx = event.clientX - held.x;
			const dt = Math.max( 1, event.timeStamp - held.at ) / 1000;
			held.v += ( dx / dt - held.v ) * 0.4;
			held.x = event.clientX;
			held.at = event.timeStamp;
			held.moved += Math.abs( dx );
			// The front of the cylinder goes with the pointer: a slider moves
			// its slides to the left as it is shifted on.
			move( -dx * 1.2 );
		};
		const up = ( event: PointerEvent ) => {
			if ( ! held ) {
				return;
			}
			const { moved, v, at } = held;
			held = null;
			if ( moved < 6 ) {
				const index = ring.plugins.hit?.at( event.clientX, event.clientY );
				if ( index !== undefined && index >= 0 ) {
					ring.plugins.lightbox.open( index );
				}
			} else if ( event.timeStamp - at < 120 ) {
				// Still moving when it was let go: thrown.
				thrown = Math.max( -4000, Math.min( 4000, -v * 1.2 ) );
			}
		};
		const cancel = () => {
			held = null;
		};
		let asked = 0;
		const hover = ( event: PointerEvent ) => {
			cancelAnimationFrame( asked );
			asked = requestAnimationFrame( () => {
				const index = ring.plugins.hit?.at( event.clientX, event.clientY );
				root.classList.toggle( 'over', index !== undefined && index >= 0 );
			} );
		};
		root.addEventListener( 'pointerdown', down );
		win.addEventListener( 'pointermove', drag );
		win.addEventListener( 'pointerup', up );
		win.addEventListener( 'pointercancel', cancel );
		const offOpen = ring.on( 'lightbox:open', () => {
			open = true;
		} );
		const offClose = ring.on( 'lightbox:close', () => {
			open = false;
		} );

		Object.assign( window, { sliders: [ ring, mirror ] } );
		return () => {
			cancelAnimationFrame( frame );
			cancelAnimationFrame( asked );
			clearTimeout( fallback );
			seen.disconnect();
			offOpen();
			offClose();
			root.removeEventListener( 'pointerdown', down );
			win.removeEventListener( 'pointermove', drag );
			win.removeEventListener( 'pointerup', up );
			win.removeEventListener( 'pointercancel', cancel );
			ring.destroy();
			mirror.destroy();
		};
	}, [] );

	const row = ( mirror: boolean ) => (
		<div
			className={ `gs ${ mirror ? 'mirror' : 'ring' }` }
			aria-label={ mirror ? undefined : 'Pictures on a cylinder' }
			aria-hidden={ mirror || undefined }
		>
			<div className="gs-track">
				{ PICTURES.map( ( n, i ) => (
					<div className="gs-slide" key={ i }>
						<img
							className="gs-media"
							{ ...dream( n ) }
							alt={ mirror ? '' : ABOUT[ i % ABOUT.length ] }
							draggable={ false }
						/>
					</div>
				) ) }
			</div>
		</div>
	);

	return (
		<>
			<header>
				<Bar>Orbit{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<div ref={ stage } className="stage">
				<div className="gs-loading" role="progressbar" aria-label="Loading the pictures">
					<span data-gs-loaded>0</span>
				</div>
				{ row( true ) }
				{ row( false ) }
			</div>
			<main>
				{ CHAPTERS.map( ( { title, line }, i ) => (
					<section className="chapter" key={ title } aria-labelledby={ `chapter-${ i }` }>
						<div className="said">
							<span className="step">
								{ i + 1 } / { CHAPTERS.length }
							</span>
							{ i ? (
								<h2 id={ `chapter-${ i }` }>{ title }</h2>
							) : (
								<h1 id={ `chapter-${ i }` }>{ title }</h1>
							) }
							<p>{ line }</p>
							{ i === CHAPTERS.length - 1 && (
								<p className="after">
									Pictures made by code. After the{ ' ' }
									<a href="https://tympanus.net/codrops/2025/05/07/on-scroll-3d-carousel/">
										On-Scroll 3D Carousel
									</a>{ ' ' }
									by Manoela Ilic on Codrops.
								</p>
							) }
						</div>
					</section>
				) ) }
			</main>
		</>
	);
}
