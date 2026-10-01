import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from 'react';
import 'gpuslider/style.css';
import './reel.css';
import { loading, stack, videos } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { liquid, split, waves } from 'gpuslider/effects';
import { useSlider } from 'gpuslider/react';
import { film, video } from '@/lib/media';
import { Bar, drawnBy, layer } from '../mount';

// A picture made by `bin/make-dream.mjs`, as large as the screen.
const dream = ( n: number ) => {
	const name = `/media/dream/${ String( n ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w, ${ name }.jpg 1600w`,
		width: 1600,
		height: 1067,
	};
};

const SLIDES: {
	image?: number;
	video?: 'a' | 'b';
	alt: string;
	kind: string;
	title: string;
}[] = [
	{ image: 1, alt: 'A blob of chrome in pink light', kind: 'Film', title: 'Quiet Engine' },
	{ video: 'a', alt: 'Someone walking into a tunnel of coloured lights', kind: 'Field', title: 'Salt Hour' },
	{ image: 3, alt: 'Spheres of glass on a pale sky', kind: 'Sound', title: 'Paper Weather' },
	{ image: 4, alt: 'A ring of chrome that twists', kind: 'Print', title: 'Low Orbit' },
	{ video: 'b', alt: 'Another colour field that moves', kind: 'Light', title: 'Second Light' },
	{ image: 6, alt: 'Folds of holographic foil', kind: 'Space', title: 'Glass Season' },
];

/**
 * The screen before the reel, made of the events of `loading()` and of
 * nothing else: a number that runs after the one that is told, and a
 * curtain that goes up when it has said 100.
 */
function Intro( {
	told,
	what,
	onGone,
}: {
	/** How much is there, 0 to 100; null when all is. */
	told: number;
	what: string;
	onGone: () => void;
} ) {
	const count = useRef< HTMLParagraphElement >( null );
	const [ gone, setGone ] = useState( false );
	// What is told now, and who is told when it is all there: as they are
	// on the frame that reads them.
	const target = useEffectEvent( () => told );
	const over = useEffectEvent( () => onGone() );

	useEffect( () => {
		let shown = 0;
		let frame = requestAnimationFrame( function run() {
			const to = target();
			shown += ( to - shown ) * 0.12;
			if ( to - shown < 0.4 ) {
				shown = to;
			}
			// The number is written as often as a frame comes: not by React.
			count.current!.textContent = String( Math.round( shown ) );
			if ( shown < 100 ) {
				frame = requestAnimationFrame( run );
				return;
			}
			setGone( true );
			over();
		} );
		return () => cancelAnimationFrame( frame );
	}, [] );

	return (
		<div
			id="intro"
			className={ gone ? 'intro gone' : 'intro' }
			role="progressbar"
			aria-label="The reel is loading"
			aria-valuemin={ 0 }
			aria-valuemax={ 100 }
			aria-valuenow={ Math.round( told ) }
		>
			<p ref={ count } id="count" className="count">
				0
			</p>
			<p id="what" className="what">
				{ what }
			</p>
		</div>
	);
}

/**
 * A reel: a stack whose pictures and films turn into each other as the
 * page is scrolled down. The stage stays on the screen while the page
 * goes by under it, a screen of page for every slide; where the page is
 * says where the slider is, and the transitions go as far as the page
 * has. The page comes to rest on a slide, never between two.
 */
export default function Reel() {
	const [ told, setTold ] = useState( 0 );
	const [ what, setWhat ] = useState( 'Six pictures and films' );
	const [ by, setBy ] = useState( '' );
	// The slide whose words are shown: none before the curtain is up.
	const [ shown, setShown ] = useState( -1 );
	const up = useRef( false );
	const rail = useRef< HTMLSpanElement >( null );
	// How high the screen of page of one slide is: read when it changes.
	const high = useRef( 0 );

	const [ root, slider ] = useSlider(
		{
			// The page moves it: not a drag, and no round.
			drag: false,
			plugins: [
				videos(),
				stack(),
				loading( { screen: false } ),
				canvas( {
					effects: [ split(), waves( { amount: 0.6 } ), liquid() ],
					eager: true,
					layer: typeof location === 'undefined' ? undefined : layer(),
				} ),
			],
			on: {
				'loading:start': ( { total }: { total: number } ) =>
					setWhat( `${ total } pictures and films` ),
				'loading:progress': ( {
					progress,
					failed,
				}: {
					progress: number;
					failed: number;
				} ) => {
					setTold( progress * 100 );
					if ( failed ) {
						setWhat( `${ failed } of them did not come` );
					}
				},
				'loading:done': ( { late }: { late: boolean } ) => {
					setTold( 100 );
					if ( late ) {
						setWhat( 'Not all of them came in time' );
					}
				},
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
				change: ( index: number ) => up.current && setShown( index ),
			},
		},
		[]
	);

	// The page begins at the top, where the first slide is, and stays
	// there until the curtain is up.
	useEffect( () => {
		history.scrollRestoration = 'manual';
		scrollTo( 0, 0 );
		document.documentElement.classList.add( 'held' );
	}, [] );

	// Where the page is, is where the reel is.
	useEffect( () => {
		if ( ! slider ) {
			return;
		}
		Object.assign( window, { reel: slider } );
		const last = SLIDES.length - 1;
		let frame = 0;
		const follow = () => {
			frame = 0;
			const at = Math.min( last, Math.max( 0, scrollY / ( high.current || 1 ) ) );
			// The slide that is nearest is the one the slider is at.
			const near = Math.round( at );
			if ( near !== slider.index ) {
				slider.to( near, { instant: true } );
			}
			const { snaps } = slider.layout();
			const from = Math.floor( at );
			const to = Math.min( last, from + 1 );
			const want = snaps[ from ] + ( snaps[ to ] - snaps[ from ] ) * ( at - from );
			// As speed: the effects see how fast the page goes.
			slider.shift( want - slider.motion.pos, true );
			slider.slides.forEach( ( { style }, i ) => {
				style.setProperty( '--from', ( at - i ).toFixed( 4 ) );
				// The words of one slide are gone before the next come.
				style.setProperty( '--seen', Math.max( 0, 1 - Math.abs( at - i ) * 2.2 ).toFixed( 3 ) );
			} );
			rail.current!.style.transform = `scaleY(${ at / last })`;
		};
		const ask = () => {
			frame ||= requestAnimationFrame( follow );
		};
		const measure = () => {
			const way = document.documentElement.scrollHeight - innerHeight;
			const stop = document.querySelector< HTMLElement >( '.stop' )!.offsetHeight;
			// Where the screen is taller than the page of a slide, as on a
			// phone whose bar has gone, the last slide is at the end.
			high.current = Math.min( stop, way / last );
			ask();
		};
		measure();
		addEventListener( 'scroll', ask, { passive: true } );
		addEventListener( 'resize', measure );
		return () => {
			cancelAnimationFrame( frame );
			removeEventListener( 'scroll', ask );
			removeEventListener( 'resize', measure );
		};
	}, [ slider ] );

	const go = ( i: number ) =>
		scrollTo( {
			top: Math.min( SLIDES.length - 1, Math.max( 0, i ) ) * high.current,
			behavior: matchMedia( '(prefers-reduced-motion: reduce)' ).matches
				? 'instant'
				: 'smooth',
		} );

	return (
		<>
			{ /* What the page is, for who reads it without seeing it. */ }
			<h1 style={ { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' } }>A reel: pictures and films that turn into each other, drawn by gpu slider</h1>
			<Intro
				told={ told }
				what={ what }
				onGone={ () => {
					up.current = true;
					setShown( slider?.index ?? 0 );
					document.documentElement.classList.remove( 'held' );
				} }
			/>

			<div className="way" style={ { '--slides': SLIDES.length } as CSSProperties }>
				<main
					ref={ root }
					id="reel"
					className="gs reel"
					// Not a class: the classes of the root are the slider's.
					data-up={ shown < 0 ? undefined : '' }
					aria-label="A reel"
				>
					<div className="gs-track">
						{ SLIDES.map( ( slide, i ) => (
							<div
								key={ slide.title }
								className="gs-slide"
								// The classes of a slide are the slider's.
								data-shown={ i === shown ? '' : undefined }
							>
								{ slide.video ? (
									<video
										className="gs-media"
										{ ...video( slide.video ) }
										aria-label={ slide.alt }
										muted
										playsInline
										loop
										ref={ film }
									/>
								) : (
									<img
										className="gs-media"
										{ ...dream( slide.image! ) }
										sizes="100vw"
										alt={ slide.alt }
										draggable={ false }
									/>
								) }
								<div className="gs-content">
									<div className="words">
										<p>
											{ String( i + 1 ).padStart( 2, '0' ) } · { slide.kind }
										</p>
										<h2>{ slide.title }</h2>
									</div>
								</div>
							</div>
						) ) }
					</div>
					<button type="button" className="prev" aria-label="Previous" onClick={ () => go( shown - 1 ) }>
						↑
					</button>
					<button type="button" className="next" aria-label="Next" onClick={ () => go( shown + 1 ) }>
						↓
					</button>
				</main>
				{ /* A screen of page for every slide, for the page to rest on. */ }
				<div className="stops" aria-hidden="true">
					{ SLIDES.map( ( slide ) => (
						<div key={ slide.title } className="stop" />
					) ) }
				</div>
			</div>

			{ /* How far down the reel is, and a way to every slide. */ }
			<nav className="rail" aria-label="Slides">
				<span className="line">
					<span ref={ rail } className="fill" />
				</span>
				{ SLIDES.map( ( slide, i ) => (
					<button
						key={ slide.title }
						type="button"
						aria-label={ slide.title }
						aria-current={ i === shown ? 'true' : undefined }
						onClick={ () => go( i ) }
					>
						{ String( i + 1 ).padStart( 2, '0' ) }
					</button>
				) ) }
			</nav>

			<footer>
				<Bar code="reel">
					<span id="said">
						Scroll down{ by && ` · drawn by ${ by }` }
					</span>
				</Bar>
			</footer>
		</>
	);
}
