import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type DragEvent,
	type ReactNode,
} from 'react';
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Download,
	GripVertical,
	ImagePlus,
	Lock,
	Pause,
	Play,
	Plus,
	Share2,
	Shuffle,
	X,
} from 'lucide-react';
import '@/index.css';
import './studio.css';
import { BUTTON, Footer, Nav, WIDTH } from '@/components/Frame';
import {
	FORMATS,
	ORDER,
	TRANSITIONS,
	at,
	length,
	type Choice,
	type Format,
	type Plan,
} from './timeline';
import { drop, read, type Photo } from './photos';
import { createStage, type Stage } from './stage';
import { CHECKOUT, PRICE, SELLING, SIZES, allowed, mark, type Short } from './plan';
import { check, keep, kept } from './license';

/** Most photos in a film, and fewest. */
const MOST = 20;
const FEWEST = 2;

/** The photos of the site, until the visitor brings theirs. */
const SAMPLES = [ 5, 3, 7, 1, 9 ];

// Loaded when they are needed: the page does not need them before.
const encoding = () => import( './encode' );
const gallery = () => import( './gallery' );

type Export =
	| { state: 'idle' }
	| { state: 'running'; done: number }
	| { state: 'done'; url: string; file: File; seconds: number }
	| { state: 'failed'; message: string };

/** Whether the browser can export: unknown until the page runs. */
type Can = 'unknown' | 'yes' | 'no';

const seconds = ( s: number ) => `${ s.toFixed( 1 ).replace( /\.0$/, '' ) }\u202Fs`;

const shuffled = ( order: number[] ) => {
	const out = [ ...order ];
	for ( let i = out.length - 1; i > 0; i-- ) {
		const j = Math.floor( Math.random() * ( i + 1 ) );
		[ out[ i ], out[ j ] ] = [ out[ j ], out[ i ] ];
	}
	return out;
};

/** A step of making the film: its number, its name, and what it holds. */
function Part( { step, title, note, children }: { step: number; title: string; note?: ReactNode; children: ReactNode } ) {
	return (
		<section className="grid gap-3" aria-label={ title }>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<h2 className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em]">
					<span aria-hidden className="grid size-6 place-items-center rounded-full bg-secondary font-sans text-xs text-muted-foreground tabular-nums">
						{ step }
					</span>
					{ title }
				</h2>
				{ note && <span className="text-sm text-muted-foreground">{ note }</span> }
			</div>
			{ children }
		</section>
	);
}

/**
 * The film as it will be: drawn by the same stage as the export, at the
 * size of the box, on a loop, in a phone when it is as tall as one. Time
 * can be dragged; an export shows how far it is over it.
 */
function Preview( {
	photos,
	plan,
	format,
	samples,
	out,
	cancel,
	marked,
}: {
	photos: Photo[];
	plan: Plan;
	format: Format;
	samples: boolean;
	out: Export;
	cancel: () => void;
	/** Whether the film will have the mark: the preview shows it then. */
	marked: boolean;
} ) {
	const { width, height } = FORMATS[ format ];
	const phone = format === '9:16';
	const canvas = useRef< HTMLCanvasElement >( null );
	const over = useRef< HTMLCanvasElement >( null );
	const stage = useRef< Stage | null >( null );
	const [ broken, setBroken ] = useState( false );
	const [ playing, setPlaying ] = useState( true );
	const [ time, setTime ] = useState( 0 );
	// What the loop reads, as it is now.
	const now = useRef( { photos, plan, playing, time: 0, from: 0, marked, redraw: () => {} } );
	now.current.marked = marked;
	now.current.photos = photos;
	now.current.plan = plan;
	now.current.playing = playing;
	const total = length( plan );
	// The light behind the film: the colour of the photo that is seen.
	const moment = photos.length ? at( plan, Math.min( time, total ) ) : null;
	const light = moment ? photos[ moment.progress < 0.5 ? moment.from : moment.to ]?.color : undefined;

	useEffect( () => {
		const element = canvas.current!;
		try {
			// Kept, so that what is seen can be read back: by a test, a
			// screenshot.
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
			now.current.redraw();
		};
		// The mark over the film, when it will have one.
		now.current.redraw = () => {
			const layer = over.current!;
			const context = layer.getContext( '2d' )!;
			context.clearRect( 0, 0, layer.width, layer.height );
			if ( now.current.marked ) {
				mark( context, layer.width, layer.height );
			}
		};
		const observer = new ResizeObserver( size );
		observer.observe( element );
		size();
		let frame = 0;
		let last = performance.now();
		const tick = ( at_: number ) => {
			frame = requestAnimationFrame( tick );
			const state = now.current;
			const all = length( state.plan );
			if ( state.playing && all > 0 ) {
				state.time = ( state.time + Math.min( 0.1, ( at_ - last ) / 1000 ) ) % all;
			}
			last = at_;
			if ( state.photos.length ) {
				stage.current!.draw( state.photos, state.plan, state.time );
			}
			// The bar of time, ten times a second.
			if ( at_ - state.from > 100 ) {
				state.from = at_;
				setTime( state.time );
			}
		};
		frame = requestAnimationFrame( tick );
		// The fonts of the mark may come after it was drawn.
		document.fonts?.ready.then( () => now.current.redraw() );
		return () => {
			cancelAnimationFrame( frame );
			observer.disconnect();
			stage.current?.destroy();
			stage.current = null;
		};
	}, [] );
	useEffect( () => now.current.redraw(), [ marked ] );

	return (
		<div className="grid gap-4">
			<div
				className="relative isolate mx-auto"
				style={ { width: `min(100%, calc(var(--studio-high) * ${ width / height }))` } }
			>
				<div
					aria-hidden
					className="studio-glow"
					style={ { '--studio-light': light || 'transparent' } as CSSProperties }
				/>
				<div className={ phone ? 'studio-phone' : 'studio-screen' }>
					<div
						className="relative overflow-hidden bg-black"
						style={ { aspectRatio: `${ width } / ${ height }`, borderRadius: 'inherit' } }
					>
						<canvas ref={ canvas } className="absolute inset-0 size-full" aria-label="Preview of the film" role="img" />
						<canvas ref={ over } className="pointer-events-none absolute inset-0 size-full" aria-hidden />
						{ phone && <span aria-hidden className="studio-island" /> }
						{ ! photos.length && ! broken && (
							<div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/60">
								Add photos to see the film
							</div>
						) }
						{ broken && (
							<div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
								This browser cannot draw the preview: it needs WebGL 2.
							</div>
						) }
						{ samples && photos.length > 0 && out.state !== 'running' && (
							<span className={ `sq-pill absolute start-3 bg-black/55 px-2.5 py-1 text-xs text-white/85 backdrop-blur ${ phone ? 'top-12' : 'top-3' }` }>
								Sample photos
							</span>
						) }
						{ out.state === 'running' && (
							<div className="absolute inset-0 grid content-center justify-items-center gap-4 bg-black/60 p-6 text-center text-white backdrop-blur-sm">
								<span className="font-display text-5xl font-semibold tabular-nums tracking-[-0.04em]">
									{ Math.round( out.done * 100 ) }%
								</span>
								<span className="text-sm text-white/75">Rendering your video, frame by frame</span>
								<div
									className="h-1.5 w-2/3 overflow-hidden rounded-full bg-white/20"
									role="progressbar"
									aria-label="Export"
									aria-valuemin={ 0 }
									aria-valuemax={ 100 }
									aria-valuenow={ Math.round( out.done * 100 ) }
								>
									<div className="h-full rounded-full bg-white" style={ { width: `${ out.done * 100 }%` } } />
								</div>
								<button
									type="button"
									className="sq-pill mt-1 h-11 bg-white/15 px-5 text-sm font-medium transition hover:bg-white/25"
									onClick={ cancel }
								>
									Cancel
								</button>
							</div>
						) }
					</div>
				</div>
			</div>
			<div className="mx-auto flex w-full max-w-md items-center gap-3">
				<button
					type="button"
					className={ `${ BUTTON } size-11 shrink-0 justify-center px-0` }
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

/** A button on a photo of the strip: as large as a finger, drawn smaller. */
function Tool( { label, onClick, disabled, children, className = '' }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; className?: string } ) {
	return (
		<button type="button" aria-label={ label } className={ `studio-tool ${ className }` } disabled={ disabled } onClick={ onClick }>
			<span>{ children }</span>
		</button>
	);
}

/** The photos, in their order: a strip to move them in, and more to add. */
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
	const own = ! samples && photos.length > 0;
	const choose = () => input.current?.click();
	return (
		<Part step={ 1 } title="Photos" note={ own ? `${ photos.length } of ${ MOST }` : `${ FEWEST } to ${ MOST }` }>
			<div
				className={ `studio-drop grid gap-3 rounded-2xl border border-dashed p-3 transition ${
					over ? 'border-foreground/60 bg-accent' : 'border-border bg-card'
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
				{ own ? (
					<ol className="studio-strip flex gap-2 overflow-x-auto pb-1" aria-label="Photos in the order of the film">
						{ photos.map( ( photo, i ) => (
							<li
								key={ photo.id }
								className="studio-thumb relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl bg-black"
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
								<span
									aria-hidden
									title="Drag to move"
									className="absolute start-1 top-1 flex cursor-grab items-center gap-0.5 rounded-md bg-black/60 py-0.5 pe-1.5 ps-0.5 text-xs tabular-nums text-white"
								>
									<GripVertical size={ 14 } />
									{ i + 1 }
								</span>
								<Tool label={ `Remove ${ photo.name }` } className="absolute -end-1 -top-1" onClick={ () => {
									drop( photo );
									set( photos.filter( ( one ) => one !== photo ) );
								} }>
									<X size={ 14 } />
								</Tool>
								<div className="absolute inset-x-0 -bottom-1 flex justify-between">
									<Tool label={ `Move ${ photo.name } earlier` } disabled={ i === 0 } onClick={ () => move( i, i - 1 ) }>
										<ChevronLeft size={ 16 } />
									</Tool>
									<Tool label={ `Move ${ photo.name } later` } disabled={ i === photos.length - 1 } onClick={ () => move( i, i + 1 ) }>
										<ChevronRight size={ 16 } />
									</Tool>
								</div>
							</li>
						) ) }
						{ room > 0 && (
							<li className="shrink-0">
								<button
									type="button"
									className="grid aspect-[4/5] w-24 place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
									disabled={ busy }
									onClick={ choose }
								>
									<span className="grid justify-items-center gap-1 text-xs">
										<Plus size={ 20 } />
										Add
									</span>
								</button>
							</li>
						) }
					</ol>
				) : (
					<button
						type="button"
						className="grid justify-items-center gap-2 rounded-xl px-4 py-7 text-center transition hover:bg-accent"
						disabled={ busy }
						onClick={ choose }
					>
						<span className="grid size-12 place-items-center rounded-full bg-secondary">
							<ImagePlus size={ 22 } />
						</span>
						<span className="font-medium">{ busy ? 'Reading…' : 'Choose photos' }</span>
						<span className="text-sm text-muted-foreground">or drop them here · the samples play until then</span>
					</button>
				) }
				{ own && (
					<div className="flex items-center gap-3 text-sm text-muted-foreground">
						<span>{ busy ? 'Reading…' : room <= 0 ? `That is ${ MOST }, the most a film has.` : 'Drag to reorder, or drop more here.' }</span>
						<button
							type="button"
							className="ms-auto min-h-11 underline-offset-4 hover:text-foreground hover:underline"
							onClick={ () => {
								photos.forEach( drop );
								set( [] );
							} }
						>
							Remove all
						</button>
					</div>
				) }
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
					<p role="alert" className="text-sm text-amber-600 dark:text-amber-300">
						{ problems.join( ' ' ) }
					</p>
				) }
			</div>
		</Part>
	);
}

/**
 * The transitions, each as it looks: a strip of frames between two of the
 * sample photos, made when the list comes near, played by CSS.
 */
function Transitions( { choice, set, shuffle }: { choice: Choice; set: ( choice: Choice ) => void; shuffle: () => void } ) {
	const list = useRef< HTMLDivElement >( null );
	const [ looks, setLooks ] = useState< Record< number, string > >( {} );
	useEffect( () => {
		const stop = new AbortController();
		const made: string[] = [];
		const observer = new IntersectionObserver(
			( [ entry ] ) => {
				if ( ! entry.isIntersecting ) {
					return;
				}
				observer.disconnect();
				Promise.all( [ gallery(), read( '/media/p5.jpg', 'a' ), read( '/media/p3.jpg', 'b' ) ] )
					.then( ( [ { strips }, ...two ] ) =>
						strips(
							two,
							Math.round( 96 * Math.min( 2, window.devicePixelRatio || 1 ) ),
							( i, url ) => {
								made.push( url );
								setLooks( ( had ) => ( { ...had, [ i ]: url } ) );
							},
							stop.signal
						).finally( () => two.forEach( drop ) )
					)
					.catch( () => {} );
			},
			{ rootMargin: '200px' }
		);
		observer.observe( list.current! );
		return () => {
			observer.disconnect();
			stop.abort();
			made.forEach( ( url ) => URL.revokeObjectURL( url ) );
		};
	}, [] );
	const tile =
		'studio-tile group relative grid aspect-square content-end overflow-hidden rounded-xl bg-secondary text-start';
	const picked = ( on: boolean ) =>
		on && (
			<span aria-hidden className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-white text-black">
				<Check size={ 13 } strokeWidth={ 3 } />
			</span>
		);
	return (
		<Part
			step={ 2 }
			title="Transition"
			note={
				choice === 'mix' ? (
					<button type="button" className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground" onClick={ shuffle }>
						<Shuffle size={ 14 } /> Shuffle the mix
					</button>
				) : (
					TRANSITIONS[ choice ][ 0 ]
				)
			}
		>
			<div ref={ list } className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5" role="group" aria-label="Transition">
				<button
					type="button"
					className={ `${ tile } studio-mix` }
					aria-current={ choice === 'mix' ? 'true' : undefined }
					onClick={ () => set( 'mix' ) }
				>
					<span aria-hidden className="absolute inset-0 grid place-items-center text-white/90">
						<Shuffle size={ 22 } />
					</span>
					<span className="studio-label">Mix</span>
					{ picked( choice === 'mix' ) }
				</button>
				{ TRANSITIONS.map( ( [ name ], i ) => (
					<button
						key={ name }
						type="button"
						className={ tile }
						aria-current={ choice === i ? 'true' : undefined }
						onClick={ () => set( i ) }
					>
						<span
							aria-hidden
							className={ `absolute inset-0 ${ looks[ i ] ? 'studio-sprite' : 'studio-waiting' }` }
							// Each at another moment of its strip: not all of them on the
							// same photo at once.
							style={ looks[ i ] ? { backgroundImage: `url(${ looks[ i ] })`, animationDelay: `${ -( ( i * 0.53 ) % 4.8 ) }s` } : undefined }
						/>
						<span className="studio-label">{ name }</span>
						{ picked( choice === i ) }
					</button>
				) ) }
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
		<label className="grid gap-1">
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
 * Free or Pro: a choice beside the export, not in its way. Pro that is not
 * unlocked opens what it is, and where a key is entered; free stays as it
 * is, whatever is chosen here.
 */
function Quality( {
	unlocked,
	pro,
	short,
	offer,
	setPro,
	setShort,
	setOffer,
	unlock,
	lock,
}: {
	unlocked: boolean;
	pro: boolean;
	short: Short;
	offer: boolean;
	setPro: ( pro: boolean ) => void;
	setShort: ( short: Short ) => void;
	setOffer: ( offer: boolean ) => void;
	unlock: ( key: string ) => Promise< boolean >;
	lock: () => void;
} ) {
	const [ key, setKey ] = useState( '' );
	const [ wrong, setWrong ] = useState( false );
	const [ checking, setChecking ] = useState( false );
	const option = ( on: boolean ) =>
		`studio-choice grid min-h-14 content-center gap-0.5 rounded-xl px-3 py-2 text-start text-sm ${ on ? '' : 'bg-secondary' }`;
	return (
		<div className="grid gap-2">
			<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quality">
				<button type="button" role="radio" aria-checked={ ! pro } aria-current={ ! pro ? 'true' : undefined } className={ option( ! pro ) } onClick={ () => setPro( false ) }>
					<span className="font-medium">Free · 1080p</span>
					<span className="text-xs opacity-65">with gpuslider.com</span>
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={ pro }
					aria-current={ pro ? 'true' : undefined }
					className={ option( pro ) }
					onClick={ () => ( unlocked ? setPro( true ) : setOffer( ! offer ) ) }
					aria-expanded={ unlocked ? undefined : offer }
				>
					<span className="flex items-center gap-1.5 font-medium">
						Pro · up to 4K { ! unlocked && <Lock size={ 13 } aria-label="locked" /> }
					</span>
					<span className="text-xs opacity-65">no mark</span>
				</button>
			</div>
			{ pro && (
				<div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Size">
					{ SIZES.map( ( [ side, name ] ) => (
						<button
							key={ side }
							type="button"
							role="radio"
							aria-checked={ short === side }
							aria-current={ short === side ? 'true' : undefined }
							className="studio-choice h-11 rounded-xl bg-secondary text-sm font-medium"
							onClick={ () => setShort( side ) }
						>
							{ name }
						</button>
					) ) }
				</div>
			) }
			{ pro && short === 2160 && (
				<p className="text-sm text-muted-foreground">
					4K takes about four times as long as 1080p, and needs a lot of memory: on a phone, 1440p is safer.
				</p>
			) }
			{ offer && ! unlocked && (
				<section aria-label="Pro" className="relative grid gap-3 rounded-2xl border border-border bg-card p-4">
					<button
						type="button"
						aria-label="Close"
						className="absolute end-1 top-1 grid size-11 place-items-center text-muted-foreground hover:text-foreground"
						onClick={ () => setOffer( false ) }
					>
						<X size={ 18 } />
					</button>
					<h3 className="font-display text-lg font-semibold tracking-[-0.02em]">Studio Pro</h3>
					<ul className="grid gap-1.5 text-sm">
						{ [ 'Videos in 4K or 1440p, not only 1080p', 'No gpuslider.com mark', 'One payment, for good' ].map( ( line ) => (
							<li key={ line } className="flex items-start gap-2">
								<Check size={ 16 } className="mt-0.5 shrink-0" /> { line }
							</li>
						) ) }
					</ul>
					<p className="text-sm text-muted-foreground">The free export stays as it is: 1080p, with the mark.</p>
					<div className="flex flex-wrap items-center gap-3">
						<a
							href={ CHECKOUT }
							className="sq-pill inline-flex h-11 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85 aria-disabled:cursor-default aria-disabled:opacity-50"
							aria-disabled={ SELLING ? undefined : 'true' }
							onClick={ ( event ) => SELLING || event.preventDefault() }
						>
							Get Pro · { PRICE }
						</a>
						{ ! SELLING && <span className="text-sm text-muted-foreground">Not on sale yet.</span> }
					</div>
					<form
						className="grid gap-2 border-t border-border pt-3"
						onSubmit={ async ( event ) => {
							event.preventDefault();
							setChecking( true );
							const good = await unlock( key );
							setChecking( false );
							setWrong( ! good );
							if ( good ) {
								setKey( '' );
							}
						} }
					>
						<label htmlFor="studio-key" className="text-sm font-medium">
							I have a license key
						</label>
						<div className="flex gap-2">
							<input
								id="studio-key"
								value={ key }
								onChange={ ( event ) => setKey( event.target.value ) }
								autoComplete="off"
								spellCheck={ false }
								className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 font-mono text-sm"
							/>
							<button type="submit" className={ `${ BUTTON } h-11` } disabled={ ! key.trim() || checking }>
								Unlock
							</button>
						</div>
						{ wrong && (
							<p role="alert" className="text-sm text-amber-600 dark:text-amber-300">
								That key does not unlock Pro.
							</p>
						) }
					</form>
				</section>
			) }
			{ unlocked && (
				<p className="text-sm text-muted-foreground">
					Pro is unlocked in this browser.{ ' ' }
					<button type="button" className="min-h-11 underline underline-offset-4 hover:text-foreground" onClick={ lock }>
						Remove the license key
					</button>
				</p>
			) }
		</div>
	);
}

/** A rectangle of the shape of a format. */
const Shape = ( { format }: { format: Format } ) => {
	const { width, height } = FORMATS[ format ];
	const big = 22;
	return (
		<span
			aria-hidden
			className="rounded-[3px] border-2 border-current"
			style={ { width: ( big * width ) / Math.max( width, height ), height: ( big * height ) / Math.max( width, height ) } }
		/>
	);
};

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
	const [ turn, setTurn ] = useState( 1 );
	const [ hold, setHold ] = useState( 0.7 );
	const [ format, setFormat ] = useState< Format >( '9:16' );
	// The apps play a film again and again: by default it has no end.
	const [ loop, setLoop ] = useState( true );
	const [ out, setOut ] = useState< Export >( { state: 'idle' } );
	const [ can, setCan ] = useState< Can >( 'unknown' );
	const stop = useRef< AbortController | null >( null );
	// Pro: unlocked in this browser, chosen, and at which size.
	const [ unlocked, setUnlocked ] = useState( false );
	const [ tier, setTier ] = useState< 'free' | 'pro' >( 'free' );
	const [ short, setShort ] = useState< Short >( 2160 );
	const [ offer, setOffer ] = useState( false );
	const [ said, setSaid ] = useState( '' );

	const plan: Plan = { count: photos.length, hold, turn, choice, order, loop };
	const pro = unlocked && tier === 'pro';
	const rights = allowed( pro, short );
	const { width, height } = FORMATS[ format ];
	const sized = ( side: number ) => {
		const scale = side / Math.min( width, height );
		return { width: Math.round( width * scale ), height: Math.round( height * scale ) };
	};
	const size = sized( rights.short );
	const named = SIZES.find( ( [ side ] ) => side === rights.short )![ 1 ];

	// A key this browser keeps unlocks Pro again, if it still does.
	useEffect( () => {
		const key = kept();
		if ( key ) {
			check( key ).then( ( good ) => ( good ? setUnlocked( true ) : keep( null ) ) );
		}
	}, [] );

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

	// Whether the browser can encode a film of the free size, and of the
	// one chosen: a larger one it cannot is made smaller, and it says so.
	const [ fits, setFits ] = useState( true );
	useEffect( () => {
		let gone = false;
		const free = sized( 1080 );
		encoding()
			.then( async ( { settingFor } ) => [
				await settingFor( free.width, free.height ),
				await settingFor( size.width, size.height ),
			] )
			.then( ( [ base, chosen ] ) => {
				if ( ! gone ) {
					setCan( base ? 'yes' : 'no' );
					setFits( !! chosen );
				}
			} )
			.catch( () => gone || setCan( 'no' ) );
		return () => {
			gone = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
	useEffect( forget, [ photos, choice, order, turn, hold, format, loop, pro, short, forget ] );

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
		setSaid( '' );
		try {
			const { encode, settingFor } = await encoding();
			// The size chosen, or the largest below it that the encoder of
			// the browser takes.
			let side = 0;
			for ( const [ one ] of [ ...SIZES ].reverse() ) {
				if ( one <= rights.short && ( await settingFor( sized( one ).width, sized( one ).height ) ) ) {
					side = one;
					break;
				}
			}
			if ( ! side ) {
				throw new Error( 'This browser cannot encode H.264 at any of these sizes.' );
			}
			if ( side !== rights.short ) {
				setSaid(
					`This browser cannot encode ${ named } here: the video is ${ SIZES.find( ( [ one ] ) => one === side )![ 1 ] } instead.`
				);
			}
			const blob = await encode( {
				photos,
				plan,
				...sized( side ),
				allowed: { ...rights, short: side },
				signal: controller.signal,
				progress: ( done ) => setOut( { state: 'running', done } ),
			} );
			const name = `slideshow-${ format.replace( ':', 'x' ) }${ loop ? '-loop' : '' }${ pro && side !== 1080 ? `-${ SIZES.find( ( [ one ] ) => one === side )![ 1 ].toLowerCase() }` : '' }.mp4`;
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
	const total = length( plan );

	return (
		<>
			<Nav at="studio" />
			<main className={ `${ WIDTH } grid grid-cols-[minmax(0,1fr)] gap-10 pb-24` }>
				<div className="grid gap-3 pt-8 md:pt-12">
					<p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">Studio</p>
					<h1 className="max-w-4xl font-display text-4xl font-semibold tracking-[-0.035em] text-balance md:text-5xl">
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

				<div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14">
					<div className="lg:sticky lg:top-20">
						<Preview
							photos={ photos }
							plan={ plan }
							format={ format }
							samples={ samples }
							out={ out }
							cancel={ () => stop.current?.abort() }
							marked={ rights.mark }
						/>
					</div>

					<div className="grid gap-9">
						<Photos
							photos={ photos }
							samples={ samples }
							add={ add }
							set={ setPhotos }
							busy={ reading }
							problems={ problems }
						/>

						<Transitions choice={ choice } set={ setChoice } shuffle={ () => setOrder( shuffled( ORDER ) ) } />

						<Part step={ 3 } title="Timing" note={ `${ seconds( total ) } in all` }>
							<div className="grid gap-3 rounded-2xl bg-card p-4">
								<Range label="Transition" value={ turn } min={ 0.4 } max={ 3 } set={ setTurn } />
								<Range label="Time on each photo" value={ hold } min={ 0.2 } max={ 4 } set={ setHold } />
							</div>
						</Part>

						<Part step={ 4 } title="Format" note={ FORMATS[ format ].note }>
							<div className="grid grid-cols-3 gap-2" role="group" aria-label="Format">
								{ ( Object.keys( FORMATS ) as Format[] ).map( ( one ) => (
									<button
										key={ one }
										type="button"
										className="studio-choice flex h-16 items-center justify-center gap-3 rounded-xl bg-secondary px-2 text-sm font-medium"
										aria-current={ format === one ? 'true' : undefined }
										onClick={ () => setFormat( one ) }
									>
										<Shape format={ one } />
										<span className="grid text-start leading-tight">
											<span>{ FORMATS[ one ].label }</span>
											<span className="text-[0.7rem] font-normal opacity-60">
												{ FORMATS[ one ].width }×{ FORMATS[ one ].height }
											</span>
										</span>
									</button>
								) ) }
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={ loop }
								onClick={ () => setLoop( ! loop ) }
								className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-start"
							>
								<span
									aria-hidden
									className={ `relative h-6 w-10 shrink-0 rounded-full transition ${ loop ? 'bg-primary' : 'bg-secondary ring-1 ring-border' }` }
								>
									<span
										className={ `absolute top-0.5 size-5 rounded-full shadow transition-[left] motion-reduce:transition-none ${ loop ? 'left-[1.125rem] bg-primary-foreground' : 'left-0.5 bg-muted-foreground' }` }
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
								<span className="ms-auto font-mono text-sm whitespace-nowrap tabular-nums text-muted-foreground" data-testid="duration">
									{ seconds( total ) }
								</span>
							</button>
						</Part>

						<Part step={ 5 } title="Export">
							<div className="grid gap-3">
								<Quality
									unlocked={ unlocked }
									pro={ pro }
									short={ short }
									offer={ offer }
									setPro={ ( on ) => setTier( on ? 'pro' : 'free' ) }
									setShort={ setShort }
									setOffer={ setOffer }
									unlock={ async ( key ) => {
										const good = await check( key );
										if ( good ) {
											keep( key );
											setUnlocked( true );
											setTier( 'pro' );
											setOffer( false );
										}
										return good;
									} }
									lock={ () => {
										keep( null );
										setUnlocked( false );
										setTier( 'free' );
									} }
								/>
								{ running ? (
									<button
										type="button"
										className="studio-export flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-base font-medium"
										onClick={ () => stop.current?.abort() }
									>
										Rendering { Math.round( out.done * 100 ) }% · Cancel
									</button>
								) : (
									<button
										type="button"
										className="studio-export flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary text-base font-semibold text-primary-foreground disabled:cursor-default disabled:opacity-40"
										disabled={ ! enough || can === 'no' || reading }
										onClick={ start }
									>
										<Download size={ 20 } />
										Export video
										<span className="font-normal opacity-70">
											· { seconds( total ) } · { FORMATS[ format ].label } · { named }
										</span>
									</button>
								) }
								{ out.state === 'done' && (
									<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm">
										<span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
											<Check size={ 16 } strokeWidth={ 3 } />
										</span>
										<span className="grid">
											<span className="font-medium">Your video is ready</span>
											<span className="text-muted-foreground">
												Done: { seconds( out.seconds ) }, { ( out.file.size / 1024 / 1024 ).toFixed( 1 ) } MB.
											</span>
										</span>
										<span className="ms-auto flex gap-2">
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
										</span>
									</div>
								) }
								{ out.state === 'failed' && (
									<p role="alert" className="text-sm text-amber-600 dark:text-amber-300">
										{ out.message }
									</p>
								) }
								<p className="text-sm text-muted-foreground">
									{ can === 'no'
										? 'This browser cannot make the video: it needs WebCodecs with H.264, which Chrome, Edge and Safari 17.4 or later have. The preview works all the same.'
										: ! enough
										? `A film needs ${ FEWEST } photos at least.`
										: `${ size.width } × ${ size.height }, H.264 at 30 frames a second${ rights.mark ? ', with a small gpuslider.com mark in a corner' : ', no mark' }.${ samples ? ' These are sample photos: choose yours to make your own.' : '' }` }
								</p>
								{ ( said || ( ! fits && can === 'yes' ) ) && (
									<p role="status" className="text-sm text-amber-600 dark:text-amber-300">
										{ said || `This browser cannot encode ${ named } here: the video will be the largest size it can.` }
									</p>
								) }
							</div>
						</Part>
					</div>
				</div>

				<section className="grid max-w-3xl gap-3 border-t border-border pt-10">
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
