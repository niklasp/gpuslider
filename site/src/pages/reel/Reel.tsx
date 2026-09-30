import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import './reel.css';
import {
	autoplay,
	controls,
	keyboard,
	loading,
	stack,
	videos,
} from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { split, waves, warp } from 'gpuslider/effects';
import { useSlider } from 'gpuslider/react';
import { calm, film, image, video } from '@/lib/media';
import { drawnBy, layer } from '../mount';

const SLIDES: {
	image?: number;
	video?: 'a' | 'b';
	alt: string;
	kind: string;
	title: string;
}[] = [
	{ image: 4, alt: 'A pink colour field', kind: 'Film', title: 'Quiet Engine' },
	{ video: 'a', alt: 'Someone walking into a tunnel of coloured lights', kind: 'Field', title: 'Salt Hour' },
	{ image: 2, alt: 'A blue colour field', kind: 'Sound', title: 'Paper Weather' },
	{ image: 6, alt: 'A violet colour field', kind: 'Print', title: 'Low Orbit' },
	{ video: 'b', alt: 'Another colour field that moves', kind: 'Light', title: 'Second Light' },
	{ image: 1, alt: 'A warm colour field', kind: 'Space', title: 'Glass Season' },
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
	const to = useRef( told );
	to.current = told;
	const over = useRef( onGone );
	over.current = onGone;

	useEffect( () => {
		let shown = 0;
		let frame = requestAnimationFrame( function run() {
			shown += ( to.current - shown ) * 0.12;
			if ( to.current - shown < 0.4 ) {
				shown = to.current;
			}
			// The number is written as often as a frame comes: not by React.
			count.current!.textContent = String( Math.round( shown ) );
			if ( shown < 100 ) {
				frame = requestAnimationFrame( run );
				return;
			}
			setGone( true );
			over.current();
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
 * A reel: a stack whose pictures and films turn into each other.
 */
export default function Reel() {
	const [ told, setTold ] = useState( 0 );
	const [ what, setWhat ] = useState( 'Six pictures and films' );
	const [ by, setBy ] = useState( '' );
	// The slide whose words are shown: none before the curtain is up.
	const [ shown, setShown ] = useState( -1 );
	const up = useRef( false );

	const [ root, slider ] = useSlider(
		{
			loop: true,
			duration: 1500,
			plugins: [
				controls(),
				keyboard(),
				videos(),
				stack(),
				autoplay( 5000 ),
				calm(),
				loading( { screen: false } ),
				canvas( {
					effects: [ split(), waves( { amount: 0.6 } ), warp() ],
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

	// It waits for the curtain.
	useEffect( () => {
		slider?.plugins.autoplay.pause();
		Object.assign( window, { reel: slider } );
	}, [ slider ] );

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
					slider?.plugins.autoplay.play();
				} }
			/>

			<main ref={ root } id="reel" className="gs reel" aria-label="A reel">
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
									{ ...image( slide.image! ) }
									sizes="100vw"
									alt={ slide.alt }
									draggable={ false }
								/>
							) }
							<div className="gs-content">
								<p>
									{ String( i + 1 ).padStart( 2, '0' ) } · { slide.kind }
								</p>
								<h2>{ slide.title }</h2>
							</div>
						</div>
					) ) }
				</div>
				<button type="button" data-gs-prev aria-label="Previous">
					←
				</button>
				<button type="button" data-gs-next aria-label="Next">
					→
				</button>
				<button type="button" data-gs-pause aria-label="Pause">
					Ⅱ
				</button>
				<div data-gs-dots />
			</main>

			<footer>
				<a href="/examples/">gpu slider</a>
				<span id="said">
					Arrows, keys, a drag{ by && ` · drawn by ${ by }` }
				</span>
			</footer>
		</>
	);
}
