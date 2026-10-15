import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type DragEvent,
	type ReactNode,
} from 'react';
import {
	ChevronLeft,
	ChevronRight,
	Download,
	ImagePlus,
	Lock,
	Pause,
	Play,
	Share2,
	Shuffle,
	X,
} from 'lucide-react';
import '@/index.css';
import './studio.css';
import { BUTTON, FIRST, Footer, Nav, WIDTH } from '@/components/Frame';
import {
	FORMATS,
	ORDER,
	TRANSITIONS,
	length,
	type Choice,
	type Format,
	type Plan,
} from './timeline';
import { drop, read, type Photo } from './photos';
import { createStage, type Stage } from './stage';
import { allowed, mark } from './plan';

/** Most photos in a film, and fewest. */
const MOST = 20;
const FEWEST = 2;

/** The photos of the site, until the visitor brings theirs. */
const SAMPLES = [ 5, 3, 7, 1, 9 ];

// Loaded when the export begins: the page does not need it before.
const encoding = () => import( './encode' );

type Export =
	| { state: 'idle' }
	| { state: 'running'; done: number }
	| { state: 'done'; url: string; file: File; seconds: number }
	| { state: 'failed'; message: string };

/** Whether the browser can export: unknown until the page runs. */
type Can = 'unknown' | 'yes' | 'no';

const seconds = ( s: number ) => `${ s.toFixed( 1 ).replace( /\.0$/, '' ) } s`;

const shuffled = ( order: number[] ) => {
	const out = [ ...order ];
	for ( let i = out.length - 1; i > 0; i-- ) {
		const j = Math.floor( Math.random() * ( i + 1 ) );
		[ out[ i ], out[ j ] ] = [ out[ j ], out[ i ] ];
	}
	return out;
};

function Part( { title, note, children }: { title: string; note?: ReactNode; children: ReactNode } ) {
	return (
		<section className="grid gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{ title }</h2>
				{ note && <span className="text-sm text-muted-foreground">{ note }</span> }
			</div>
			{ children }
		</section>
	);
}

/**
 * The film as it will be: drawn by the same stage as the export, at the
 * size of the box, on a loop. Time can be dragged.
 */
function Preview( { photos, plan, format, samples }: { photos: Photo[]; plan: Plan; format: Format; samples: boolean } ) {
	const { width, height } = FORMATS[ format ];
	const canvas = useRef< HTMLCanvasElement >( null );
	const over = useRef< HTMLCanvasElement >( null );
	const stage = useRef< Stage | null >( null );
	const [ broken, setBroken ] = useState( false );
	const [ playing, setPlaying ] = useState( true );
	const [ time, setTime ] = useState( 0 );
	// What the loop reads, as it is now.
	const now = useRef( { photos, plan, playing, time: 0, from: 0 } );
	now.current.photos = photos;
	now.current.plan = plan;
	now.current.playing = playing;
	const total = length( plan );

	useEffect( () => {
		const element = canvas.current!;
		try {
			// Kept, so that what is seen can be read back: by a test, a screenshot.
			stage.current = createStage( element, { preserve: true } );
		} catch {
			setBroken( true );
			return;
		}
		// As large as the box, in pixels of the screen.
		const size = () => {
			const ratio = Math.min( 2, window.devicePixelRatio || 1 );
			const w = Math.max( 1, Math.round( element.clientWidth * ratio ) );
			const h = Math.max( 1, Math.round( element.clientHeight * ratio ) );
			[ element, over.current! ].forEach( ( one ) => {
				one.width = w;
				one.height = h;
			} );
			if ( allowed().mark ) {
				mark( over.current!.getContext( '2d' )!, w, h );
			}
		};
		const observer = new ResizeObserver( size );
		observer.observe( element );
		size();
		let frame = 0;
		let last = performance.now();
		const tick = ( at: number ) => {
			frame = requestAnimationFrame( tick );
			const state = now.current;
			const all = length( state.plan );
			if ( state.playing && all > 0 ) {
				state.time = ( state.time + Math.min( 0.1, ( at - last ) / 1000 ) ) % all;
			}
			last = at;
			if ( state.photos.length ) {
				stage.current!.draw( state.photos, state.plan, state.time );
			}
			// The bar of time, ten times a second.
			if ( at - state.from > 100 ) {
				state.from = at;
				setTime( state.time );
			}
		};
		frame = requestAnimationFrame( tick );
		// The fonts of the mark may come after it was drawn.
		document.fonts?.ready.then( size );
		return () => {
			cancelAnimationFrame( frame );
			observer.disconnect();
			stage.current?.destroy();
			stage.current = null;
		};
	}, [] );

	return (
		<div className="grid gap-3">
			<div
				className="studio-frame relative mx-auto overflow-hidden bg-black ring-1 ring-white/10"
				style={ {
					aspectRatio: `${ width } / ${ height }`,
					width: `min(100%, calc(var(--studio-high) * ${ width / height }))`,
				} }
			>
				<canvas ref={ canvas } className="absolute inset-0 size-full" aria-label="Preview of the film" role="img" />
				<canvas ref={ over } className="pointer-events-none absolute inset-0 size-full" aria-hidden />
				{ ! photos.length && ! broken && (
					<div className="absolute inset-0 grid place-items-center text-sm text-white/60">
						Add photos to see the film
					</div>
				) }
				{ broken && (
					<div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
						This browser cannot draw the preview: it needs WebGL 2.
					</div>
				) }
				{ samples && photos.length > 0 && (
					<span className="sq-pill absolute start-3 top-3 bg-black/55 px-2.5 py-1 text-xs text-white/85 backdrop-blur">
						Sample photos
					</span>
				) }
			</div>
			<div className="mx-auto flex w-full max-w-xl items-center gap-3">
				<button
					type="button"
					className={ `${ BUTTON } size-11 justify-center px-0` }
					aria-label={ playing ? 'Pause' : 'Play' }
					onClick={ () => setPlaying( ! playing ) }
				>
					{ playing ? <Pause size={ 18 } /> : <Play size={ 18 } /> }
				</button>
				<input
					type="range"
					aria-label="Time"
					className="studio-range min-w-0 flex-1"
					min={ 0 }
					max={ Math.max( 0.01, total ) }
					step={ 0.01 }
					value={ Math.min( time, total ) }
					onChange={ ( event ) => {
						now.current.time = +event.target.value;
						setTime( +event.target.value );
					} }
				/>
				<span className="w-24 shrink-0 text-end font-mono text-xs tabular-nums text-muted-foreground">
					{ time.toFixed( 1 ) } / { total.toFixed( 1 ) } s
				</span>
			</div>
		</div>
	);
}

/** The photos, in their order: moved, taken out, more added. */
function Photos( {
	photos,
	samples,
	add,
	set,
	busy,
	problems,
}: {
	photos: Photo[];
	samples: boolean;
	add: ( files: File[] ) => void;
	set: ( photos: Photo[] ) => void;
	busy: boolean;
	problems: string[];
} ) {
	const input = useRef< HTMLInputElement >( null );
	const [ over, setOver ] = useState( false );
	const dragged = useRef( -1 );
	const move = ( from: number, to: number ) => {
		if ( to < 0 || to >= photos.length || from === to ) {
			return;
		}
		const next = [ ...photos ];
		next.splice( to, 0, ...next.splice( from, 1 ) );
		set( next );
	};
	const dropped = ( event: DragEvent ) => {
		event.preventDefault();
		setOver( false );
		const files = [ ...event.dataTransfer.files ].filter( ( file ) => file.type.startsWith( 'image/' ) || ! file.type );
		if ( files.length ) {
			add( files );
		}
	};
	const room = MOST - ( samples ? 0 : photos.length );
	return (
		<Part title="Photos" note={ samples ? `${ FEWEST } to ${ MOST }` : `${ photos.length } of ${ MOST }` }>
			<div
				className={ `studio-drop sq-tile grid gap-3 border border-dashed p-3 transition ${
					over ? 'border-primary bg-primary/10' : 'border-white/15 bg-card'
				}` }
				onDragOver={ ( event ) => {
					if ( dragged.current < 0 ) {
						event.preventDefault();
						setOver( true );
					}
				} }
				onDragLeave={ () => setOver( false ) }
				onDrop={ ( event ) => dragged.current < 0 && dropped( event ) }
			>
				{ ! samples && photos.length > 0 && (
					<ol className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Photos in the order of the film">
						{ photos.map( ( photo, i ) => (
							<li
								key={ photo.id }
								className="group relative aspect-square overflow-hidden rounded-lg bg-black"
								draggable
								onDragStart={ () => ( dragged.current = i ) }
								onDragEnd={ () => ( dragged.current = -1 ) }
								onDragOver={ ( event ) => dragged.current >= 0 && event.preventDefault() }
								onDrop={ ( event ) => {
									event.preventDefault();
									move( dragged.current, i );
									dragged.current = -1;
								} }
							>
								<img src={ photo.thumb } alt={ photo.name } className="size-full object-cover" draggable={ false } />
								<span className="absolute start-1.5 top-1.5 rounded bg-black/60 px-1.5 text-xs tabular-nums text-white">
									{ i + 1 }
								</span>
								<button
									type="button"
									aria-label={ `Remove ${ photo.name }` }
									className="studio-tool absolute end-1 top-1"
									onClick={ () => {
										drop( photo );
										set( photos.filter( ( one ) => one !== photo ) );
									} }
								>
									<X size={ 16 } />
								</button>
								<div className="absolute inset-x-1 bottom-1 flex justify-between">
									<button
										type="button"
										aria-label={ `Move ${ photo.name } earlier` }
										className="studio-tool"
										disabled={ i === 0 }
										onClick={ () => move( i, i - 1 ) }
									>
										<ChevronLeft size={ 16 } />
									</button>
									<button
										type="button"
										aria-label={ `Move ${ photo.name } later` }
										className="studio-tool"
										disabled={ i === photos.length - 1 }
										onClick={ () => move( i, i + 1 ) }
									>
										<ChevronRight size={ 16 } />
									</button>
								</div>
							</li>
						) ) }
					</ol>
				) }
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="button"
						className={ `${ BUTTON } h-11 gap-2` }
						disabled={ busy || room <= 0 }
						onClick={ () => input.current?.click() }
					>
						<ImagePlus size={ 18 } />
						{ samples || ! photos.length ? 'Choose photos' : 'Add photos' }
					</button>
					<span className="text-sm text-muted-foreground">
						{ busy ? 'Reading…' : room <= 0 ? `That is ${ MOST }, the most a film has.` : 'or drop them here' }
					</span>
					{ ! samples && photos.length > 0 && (
						<button
							type="button"
							className="ms-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
							onClick={ () => {
								photos.forEach( drop );
								set( [] );
							} }
						>
							Remove all
						</button>
					) }
				</div>
				<input
					ref={ input }
					type="file"
					accept="image/*"
					multiple
					hidden
					data-testid="photos"
					onChange={ ( event ) => {
						const files = [ ...( event.target.files || [] ) ];
						event.target.value = '';
						if ( files.length ) {
							add( files );
						}
					} }
				/>
				{ problems.length > 0 && (
					<p role="alert" className="text-sm text-amber-300">
						{ problems.join( ' ' ) }
					</p>
				) }
			</div>
		</Part>
	);
}

function Range( {
	label,
	value,
	min,
	max,
	set,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	set: ( value: number ) => void;
} ) {
	return (
		<label className="grid gap-1.5">
			<span className="flex justify-between text-sm">
				<span>{ label }</span>
				<span className="font-mono tabular-nums text-muted-foreground">{ seconds( value ) }</span>
			</span>
			<input
				type="range"
				className="studio-range"
				min={ min }
				max={ max }
				step={ 0.1 }
				value={ value }
				onChange={ ( event ) => set( +event.target.value ) }
			/>
		</label>
	);
}

/**
 * A photo slideshow as a film for Reels, TikTok and Shorts, with the
 * transitions of the library, made and exported in the browser.
 */
export default function Studio() {
	const [ photos, setPhotos ] = useState< Photo[] >( [] );
	const [ samples, setSamples ] = useState( true );
	const [ reading, setReading ] = useState( false );
	const [ problems, setProblems ] = useState< string[] >( [] );
	const [ choice, setChoice ] = useState< Choice >( 'mix' );
	const [ order, setOrder ] = useState( ORDER );
	const [ turn, setTurn ] = useState( 1.5 );
	const [ hold, setHold ] = useState( 0.9 );
	const [ format, setFormat ] = useState< Format >( '9:16' );
	// The apps play a film again and again: by default it has no end.
	const [ loop, setLoop ] = useState( true );
	const [ out, setOut ] = useState< Export >( { state: 'idle' } );
	const [ can, setCan ] = useState< Can >( 'unknown' );
	const stop = useRef< AbortController | null >( null );

	const plan: Plan = { count: photos.length, hold, turn, choice, order, loop };
	const { width, height } = FORMATS[ format ];
	const short = allowed().short;
	const scale = short / Math.min( width, height );
	const size = { width: Math.round( width * scale ), height: Math.round( height * scale ) };

	// The photos of the site, while the visitor has none of theirs.
	useEffect( () => {
		let gone = false;
		Promise.all( SAMPLES.map( ( n ) => read( `/media/p${ n }.jpg`, `Sample ${ n }` ) ) )
			.then( ( made ) => {
				if ( gone ) {
					made.forEach( drop );
				} else {
					setPhotos( ( had ) => ( had.length ? ( made.forEach( drop ), had ) : made ) );
				}
			} )
			.catch( () => {} );
		return () => {
			gone = true;
		};
	}, [] );

	// Whether the browser can encode a film of this size.
	useEffect( () => {
		let gone = false;
		encoding()
			.then( ( { settingFor } ) => settingFor( size.width, size.height ) )
			.then( ( setting ) => gone || setCan( setting ? 'yes' : 'no' ) )
			.catch( () => gone || setCan( 'no' ) );
		return () => {
			gone = true;
		};
	}, [ size.width, size.height ] );

	// A finished film is another one once anything changes.
	const forget = useCallback( () => {
		setOut( ( was ) => {
			if ( was.state === 'done' ) {
				URL.revokeObjectURL( was.url );
			}
			return was.state === 'running' ? was : { state: 'idle' };
		} );
	}, [] );
	useEffect( forget, [ photos, choice, order, turn, hold, format, loop, forget ] );

	const add = async ( files: File[] ) => {
		setReading( true );
		const room = MOST - ( samples ? 0 : photos.length );
		const taken = files.slice( 0, Math.max( 0, room ) );
		const said: string[] = [];
		if ( files.length > taken.length ) {
			said.push( `A film has ${ MOST } photos at most: ${ files.length - taken.length } were left out.` );
		}
		const made: Photo[] = [];
		for ( const file of taken ) {
			try {
				made.push( await read( file, file.name ) );
			} catch {
				said.push( `${ file.name } could not be read by this browser${ /hei[cf]$/i.test( file.name ) ? ' (HEIC: try a JPEG)' : '' }.` );
			}
		}
		if ( made.length ) {
			if ( samples ) {
				photos.forEach( drop );
				setSamples( false );
				setPhotos( made );
			} else {
				setPhotos( [ ...photos, ...made ] );
			}
		}
		setProblems( said );
		setReading( false );
	};

	const start = async () => {
		const controller = new AbortController();
		stop.current = controller;
		setOut( { state: 'running', done: 0 } );
		try {
			const { encode } = await encoding();
			const blob = await encode( {
				photos,
				plan,
				...size,
				allowed: allowed(),
				signal: controller.signal,
				progress: ( done ) => setOut( { state: 'running', done } ),
			} );
			const name = `slideshow-${ format.replace( ':', 'x' ) }${ loop ? '-loop' : '' }.mp4`;
			const file = new File( [ blob ], name, { type: 'video/mp4' } );
			const url = URL.createObjectURL( file );
			setOut( { state: 'done', url, file, seconds: length( plan ) } );
			// The download begins by itself, where the browser lets it.
			const link = document.createElement( 'a' );
			link.href = url;
			link.download = name;
			link.click();
		} catch ( error ) {
			setOut(
				controller.signal.aborted
					? { state: 'idle' }
					: { state: 'failed', message: ( error as Error )?.message || 'The export failed.' }
			);
		} finally {
			stop.current = null;
		}
	};

	const enough = photos.length >= FEWEST;
	const running = out.state === 'running';
	const shareable =
		out.state === 'done' &&
		typeof navigator !== 'undefined' &&
		!! navigator.canShare?.( { files: [ out.file ] } );

	return (
		<>
			<Nav at="studio" />
			<main className={ `${ WIDTH } grid grid-cols-[minmax(0,1fr)] gap-10 pb-24` }>
				<div className="grid gap-4 pt-10 md:pt-16">
					<p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">Studio</p>
					<h1 className="max-w-4xl font-display text-4xl font-semibold tracking-[-0.035em] text-balance md:text-6xl">
						Photo slideshow maker with shader transitions
					</h1>
					<p className="max-w-2xl text-lg text-balance text-muted-foreground">
						Turn a few photos into a video for Reels, TikTok and Shorts: one
						of twenty-four transitions, or a different one at every cut. Export
						it as an MP4, free.
					</p>
					<p className="flex items-start gap-2 text-sm text-muted-foreground">
						<Lock size={ 16 } className="mt-0.5 shrink-0" />
						<span>
							Your photos never leave your browser: nothing is uploaded, the
							video is made on your device.
						</span>
					</p>
				</div>

				<div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
					<div className="lg:sticky lg:top-20">
						<Preview photos={ photos } plan={ plan } format={ format } samples={ samples } />
					</div>

					<div className="grid gap-8">
						<Photos
							photos={ photos }
							samples={ samples }
							add={ add }
							set={ setPhotos }
							busy={ reading }
							problems={ problems }
						/>

						<Part
							title="Transition"
							note={
								choice === 'mix' ? (
									<button
										type="button"
										className="inline-flex items-center gap-1.5 hover:text-foreground"
										onClick={ () => setOrder( shuffled( ORDER ) ) }
									>
										<Shuffle size={ 14 } /> Shuffle the mix
									</button>
								) : undefined
							}
						>
							<div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="group" aria-label="Transition">
								<button
									type="button"
									className={ `${ BUTTON } h-11 justify-center` }
									aria-current={ choice === 'mix' ? 'true' : undefined }
									onClick={ () => setChoice( 'mix' ) }
								>
									Mix
								</button>
								{ TRANSITIONS.map( ( [ name ], i ) => (
									<button
										key={ name }
										type="button"
										className={ `${ BUTTON } h-11 justify-center px-2` }
										aria-current={ choice === i ? 'true' : undefined }
										onClick={ () => setChoice( i ) }
									>
										{ name }
									</button>
								) ) }
							</div>
						</Part>

						<Part title="Speed" note={ `${ seconds( length( plan ) ) } in all` }>
							<div className="grid gap-4">
								<Range label="Transition" value={ turn } min={ 0.4 } max={ 3 } set={ setTurn } />
								<Range label="Time on each photo" value={ hold } min={ 0.2 } max={ 4 } set={ setHold } />
							</div>
						</Part>

						<Part title="Format" note={ FORMATS[ format ].note }>
							<div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Format">
								{ ( Object.keys( FORMATS ) as Format[] ).map( ( one ) => (
									<button
										key={ one }
										type="button"
										className={ `${ BUTTON } h-14 flex-col justify-center gap-0.5 leading-none` }
										aria-current={ format === one ? 'true' : undefined }
										onClick={ () => setFormat( one ) }
									>
										<span>{ FORMATS[ one ].label }</span>
										<span className="text-[0.7rem] opacity-60">
											{ FORMATS[ one ].width } × { FORMATS[ one ].height }
										</span>
									</button>
								) ) }
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={ loop }
								onClick={ () => setLoop( ! loop ) }
								className="flex min-h-11 items-center gap-3 text-start"
							>
								<span
									aria-hidden
									className={ `relative h-6 w-10 shrink-0 rounded-full transition ${ loop ? 'bg-primary' : 'bg-white/15' }` }
								>
									<span
										className={ `absolute top-0.5 size-5 rounded-full bg-background transition-[left] ${ loop ? 'left-[1.125rem]' : 'left-0.5' }` }
									/>
								</span>
								<span className="grid">
									<span className="text-sm">Loop</span>
									<span className="text-xs text-muted-foreground">
										{ loop
											? 'The last photo turns into the first: played again, there is no jump.'
											: 'Ends on the last photo.' }
									</span>
								</span>
								<span className="ms-auto font-mono text-sm tabular-nums text-muted-foreground" data-testid="duration">
									{ seconds( length( plan ) ) }
								</span>
							</button>
						</Part>

						<Part title="Export">
							<div className="sq-tile grid gap-3 bg-card p-4">
								{ running ? (
									<>
										<div
											className="h-2 overflow-hidden rounded-full bg-white/10"
											role="progressbar"
											aria-label="Export"
											aria-valuemin={ 0 }
											aria-valuemax={ 100 }
											aria-valuenow={ Math.round( out.done * 100 ) }
										>
											<div className="h-full bg-primary transition-[width]" style={ { width: `${ out.done * 100 }%` } } />
										</div>
										<div className="flex items-center justify-between gap-3 text-sm">
											<span className="tabular-nums text-muted-foreground">
												Rendering frame by frame… { Math.round( out.done * 100 ) }%
											</span>
											<button type="button" className={ `${ BUTTON } h-11` } onClick={ () => stop.current?.abort() }>
												Cancel
											</button>
										</div>
									</>
								) : (
									<button
										type="button"
										className={ `${ FIRST } w-full justify-center gap-2 disabled:cursor-default disabled:opacity-40` }
										disabled={ ! enough || can === 'no' || reading }
										onClick={ start }
									>
										<Download size={ 18 } />
										Export MP4 · { size.width } × { size.height }
									</button>
								) }
								{ out.state === 'done' && (
									<div className="flex flex-wrap items-center gap-3 text-sm">
										<span className="text-muted-foreground">
											Done: { seconds( out.seconds ) }, { ( out.file.size / 1024 / 1024 ).toFixed( 1 ) } MB.
										</span>
										<a className={ `${ BUTTON } h-11 gap-2` } href={ out.url } download={ out.file.name } data-testid="download">
											<Download size={ 16 } /> Download
										</a>
										{ shareable && (
											<button
												type="button"
												className={ `${ BUTTON } h-11 gap-2` }
												onClick={ () => navigator.share( { files: [ out.file ] } ).catch( () => {} ) }
											>
												<Share2 size={ 16 } /> Share
											</button>
										) }
									</div>
								) }
								{ out.state === 'failed' && (
									<p role="alert" className="text-sm text-amber-300">
										{ out.message }
									</p>
								) }
								<p className="text-sm text-muted-foreground">
									{ can === 'no'
										? 'This browser cannot make the video: it needs WebCodecs with H.264, which Chrome, Edge and Safari 17.4 or later have. The preview works all the same.'
										: ! enough
										? `A film needs ${ FEWEST } photos at least.`
										: samples
										? 'These are sample photos: choose yours to make your own.'
										: `H.264 at 30 frames a second${ allowed().mark ? ', with a small gpuslider.com mark in a corner' : '' }.` }
								</p>
							</div>
						</Part>
					</div>
				</div>

				<section className="grid max-w-3xl gap-3 border-t border-white/8 pt-10">
					<h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">How it is made</h2>
					<p className="text-muted-foreground">
						The transitions are the ones of{ ' ' }
						<a className="text-foreground underline underline-offset-4" href="/">
							gpu slider
						</a>
						, a slider for the web whose pictures are drawn by shaders. Here
						they are drawn frame by frame at the time of each frame and encoded
						by your browser, so the video is smooth even where the preview is
						not. The same transitions run in a slider on your own site: see{ ' ' }
						<a className="text-foreground underline underline-offset-4" href="/docs/effects/">
							Effects and transitions
						</a>
						.
					</p>
				</section>
			</main>
			<Footer />
		</>
	);
}
