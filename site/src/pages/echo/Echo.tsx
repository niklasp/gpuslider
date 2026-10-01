import { useEffect, useRef, useState } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import './echo.css';
import { createSlider, type Slider } from 'gpuslider';
import { autoplay, keyboard, loading, thumbs } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { image, photo } from '@/lib/media';
import { Bar, drawnBy, layer, share, shared } from '../mount';
import { echo, linger, WAYS, type Way } from './echo-effect';

// The eight photos, each once.
const SLIDES = [ 1, 2, 3, 4, 5, 6, 7, 8 ];

// What the effect reads on every frame: written into, never replaced.
const PARAMS = Object.fromEntries(
	Object.entries( WAYS.Frames ).map( ( [ name, value ] ) => [ name, [ value ] ] )
) as Record< keyof ( typeof WAYS )[ Way ], number[] >;
// How fast the reel has moved of late: written by `linger()`.
const TRAIL = [ 0 ];
// From a slide to the next, px: measured by the page.
const PITCH = [ 1e5 ];

/**
 * Echo: a reel whose pictures leave frames of themselves behind as they
 * move, the farther apart the faster. A thumbnail sends the reel to its
 * picture, and the picture arrives as a stream of frames. One canvas draws
 * it all: no picture is copied in the page. After the repeating image
 * transition of Manoela Ilic on Codrops.
 */
export default function Echo() {
	const stage = useRef< HTMLDivElement >( null );
	const strip = useRef< HTMLDivElement >( null );
	const reel = useRef< Slider >( null );
	const [ by, setBy ] = useState( '' );
	const [ at, setAt ] = useState( 0 );
	const [ way, setWay ] = useState< Way >( 'Frames' );
	const [ frames, setFrames ] = useState( WAYS.Frames.frames );

	const choose = ( to: Way ) => {
		for ( const [ name, value ] of Object.entries( WAYS[ to ] ) ) {
			PARAMS[ name as keyof typeof PARAMS ][ 0 ] = value;
		}
		setFrames( WAYS[ to ].frames );
		reel.current?.wake();
		setWay( to );
		share( 'way', to );
		share( 'frames', undefined );
	};

	const count = ( n: number ) => {
		setFrames( n );
		PARAMS.frames[ 0 ] = n;
		reel.current?.wake();
		share( 'frames', n );
	};

	useEffect( () => {
		const made = createSlider( stage.current!, {
			loop: true,
			align: 'center',
			// Long enough to read the stream of frames.
			duration: 1100,
			plugins: [
				loading( { min: 500 } ),
				autoplay( 3600 ),
				keyboard(),
				linger( TRAIL ),
				canvas( { effects: [ echo( { ...PARAMS, trail: TRAIL, pitch: PITCH } ) ], layer: layer() } ),
			],
			on: {
				change: ( index: number ) => setAt( index ),
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
			},
		} );
		const strips = createSlider( strip.current!, {
			align: 'center',
			plugins: [ thumbs( made ) ],
		} );
		// Where the next slide is: the frames are not drawn over it.
		const track = stage.current!.querySelector< HTMLElement >( '.gs-track' )!;
		const measure = () => {
			const slide = track.firstElementChild as HTMLElement;
			PITCH[ 0 ] = slide.offsetWidth + parseFloat( getComputedStyle( track ).columnGap || '0' );
			made.wake();
		};
		measure();
		const sizes = new ResizeObserver( measure );
		sizes.observe( stage.current! );
		reel.current = made;
		// A link can say how the frames fall: ?way=arc&frames=12.
		const n = Number( new URLSearchParams( location.search ).get( 'frames' ) );
		const linked = shared( 'way', Object.keys( WAYS ) as Way[] );
		if ( linked ) {
			choose( linked );
		}
		if ( n ) {
			count( Math.min( 12, Math.max( 1, Math.round( n ) ) ) );
		}
		Object.assign( window, { slider: made, trail: TRAIL } );
		return () => {
			sizes.disconnect();
			strips.destroy();
			made.destroy();
		};
	}, [] );

	return (
		<>
			<header>
				<Bar code="echo">Echo{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<main>
				<div ref={ stage } className="gs reel" aria-label="Photos">
					<div className="gs-track">
						{ SLIDES.map( ( n ) => (
							<div className="gs-slide" key={ n }>
								<img
									className="gs-media"
									{ ...image( n, 'photos' ) }
									sizes="(max-width: 700px) 84vw, 60vw"
									alt={ photo( n ).alt }
									draggable={ false }
								/>
							</div>
						) ) }
					</div>
				</div>

				<p className="said" aria-live="polite">
					<span className="count">
						{ String( at + 1 ).padStart( 2, '0' ) } / { String( SLIDES.length ).padStart( 2, '0' ) }
					</span>
					<span className="alt">{ photo( SLIDES[ at ] ).alt }</span>
				</p>

				<div ref={ strip } className="gs strip" aria-label="Go to a photo">
					<div className="gs-track">
						{ SLIDES.map( ( n ) => (
							<div className="gs-slide" key={ n }>
								<img
									className="gs-media"
									{ ...image( n, 'photos' ) }
									sizes="120px"
									alt={ photo( n ).alt }
									draggable={ false }
								/>
							</div>
						) ) }
					</div>
				</div>

				<div className="ways" role="group" aria-label="How the frames fall">
					{ ( Object.keys( WAYS ) as Way[] ).map( ( one ) => (
						<button
							key={ one }
							type="button"
							aria-pressed={ one === way }
							onClick={ () => choose( one ) }
						>
							{ one }
						</button>
					) ) }
					<label className="length">
						Frames
						<input
							type="range"
							min={ 1 }
							max={ 12 }
							step={ 1 }
							value={ frames }
							onChange={ ( event ) => count( Number( event.target.value ) ) }
						/>
					</label>
				</div>
			</main>
			<footer>
				<p>
					Drag the reel, or pick a photo below: it arrives as a stream of
					frames, the farther apart the faster it goes. One effect,{ ' ' }
					<code>echo()</code>, written for this page: the slide and its frames
					are one pass of the canvas, and nothing is copied in the page.
				</p>
				<p>
					After{ ' ' }
					<a href="https://tympanus.net/codrops/2025/04/28/animating-in-frames-repeating-image-transition/">
						Animating in Frames
					</a>{ ' ' }
					by Manoela Ilic. Photos from Pexels.
				</p>
			</footer>
		</>
	);
}
