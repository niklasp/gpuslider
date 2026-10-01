import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '@fontsource-variable/funnel-display';
import 'gpuslider/style.css';
import './journal.css';
import { createSlider } from 'gpuslider';
import { autoplay, controls, keyboard, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch } from 'gpuslider/effects';
import { image, photo } from '@/lib/media';
import { Bar, drawnBy, layer } from '../mount';
import { STORIES, minutesIn } from './stories';

const address = ( slug: string ) => `/examples/journal/${ slug }/`;

/** The light of the photo of a story, for the page around it. */
const lit = ( n: number ) =>
	( { '--light': photo( n ).light } ) as CSSProperties;

/**
 * The journal: its stories in a slider whose pictures the canvas draws. A
 * click on one opens the story, and the picture goes with it (see the
 * script in `examples/journal/index.html`).
 */
export function Journal() {
	const root = useRef< HTMLDivElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const slider = createSlider( root.current!, {
			plugins: [
				controls(),
				keyboard(),
				wheel(),
				// It goes on by itself, so that the stretch is seen; and waits
				// under the pointer, where a story is about to be opened.
				autoplay( 4000 ),
				canvas( {
					// Nothing that moves the picture in a slide at rest: the
					// picture that goes to the story is the one that is seen.
					effects: [ stretch() ],
					layer: layer(),
				} ),
			],
			on: {
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
			},
		} );
		Object.assign( window, { slider } );
		return () => slider.destroy();
	}, [] );

	return (
		<>
			<header>
				<Bar code="journal">Journal{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<main>
				<div className="masthead">
					<h1>Afterlight</h1>
					<p>
						Seven people lit by the night. Open a story: its picture
						leaves the slider and becomes the top of the page.
					</p>
				</div>
				<div
					ref={ root }
					className="gs shelf"
					aria-label="The stories"
				>
					<div className="gs-track">
						{ STORIES.map( ( { slug, n, title, about }, i ) => (
							<div className="gs-slide" data-story={ slug } key={ slug }>
								<img
									className="gs-media"
									{ ...image( n, 'photos' ) }
									sizes="(max-width: 700px) 80vw, 30vw"
									alt=""
									draggable={ false }
									loading={ i < 4 ? 'eager' : 'lazy' }
									fetchPriority={ i === 0 ? 'high' : 'auto' }
								/>
								<a className="gs-content" href={ address( slug ) } style={ lit( n ) }>
									<h2>{ title }</h2>
									<p>{ about }</p>
								</a>
							</div>
						) ) }
					</div>
					<button type="button" className="arrow" data-gs-prev aria-label="Previous stories" />
					<button type="button" className="arrow" data-gs-next aria-label="Next stories" />
				</div>
				<p className="hint">Pick a picture to open its story.</p>
			</main>
			<footer>
				<p>
					An example of gpu slider with a view transition between pages,
					where the browser has them. The stories are made up; the
					photos are from Pexels.
				</p>
			</footer>
		</>
	);
}

/** The night of the stories, from eight to two: where each is in it. */
const NIGHT = 6 * 60;
const HOURS = [ '20:00', '22:00', '00:00', '02:00' ];

function Night( { slug }: { slug: string } ) {
	const night = [ ...STORIES ].sort(
		( a, b ) => minutesIn( a.time ) - minutesIn( b.time )
	);
	return (
		<nav className="night" aria-labelledby="night">
			<h2 id="night">One night, seven stories</h2>
			<ol>
				{ night.map( ( story ) => {
					const at = minutesIn( story.time ) / NIGHT;
					const place = {
						...lit( story.n ),
						left: `${ at * 100 }%`,
						'--at': at,
					} as CSSProperties;
					return (
						<li key={ story.slug } style={ place }>
							<a
								href={ address( story.slug ) }
								aria-current={ story.slug === slug ? 'page' : undefined }
							>
								<span>
									<time>{ story.time }</time>
									{ story.title }
								</span>
							</a>
						</li>
					);
				} ) }
			</ol>
			<p className="hours" aria-hidden="true">
				{ HOURS.map( ( hour ) => (
					<span key={ hour }>{ hour }</span>
				) ) }
			</p>
		</nav>
	);
}

/**
 * A story: its picture over the whole width, what it says beside when and
 * where it was, its place in the night, and the next one.
 */
export function Story( { slug }: { slug: string } ) {
	const at = STORIES.findIndex( ( story ) => story.slug === slug );
	const { n, title, about, text, pexels, place, time, lit: by, said } =
		STORIES[ at ];
	const next = STORIES[ ( at + 1 ) % STORIES.length ];
	const { style, ...picture } = image( n, 'photos' );
	const minutes = Math.max(
		1,
		Math.round( text.join( ' ' ).split( /\s+/ ).length / 200 )
	);
	// What was said comes in the middle of the story.
	const middle = Math.ceil( text.length / 2 );
	const paragraph = ( words: string ) => (
		<p key={ words.slice( 0, 20 ) }>{ words }</p>
	);

	return (
		<>
			<header>
				<a href="/examples/journal/">← Afterlight</a>
				<span>
					Made with <a href="/">gpu slider</a>
				</span>
			</header>
			<main className="story" style={ lit( n ) }>
				<img
					id="hero"
					className="hero"
					{ ...picture }
					style={ { ...style, viewTransitionName: 'photo' } }
					sizes="100vw"
					alt={ photo( n ).alt }
					fetchPriority="high"
				/>
				<article>
					<h1>{ title }</h1>
					<p className="about">{ about }</p>
					<dl className="facts">
						<div>
							<dt>Where</dt>
							<dd>{ place }</dd>
						</div>
						<div>
							<dt>When</dt>
							<dd>
								<time>{ time }</time>
							</dd>
						</div>
						<div>
							<dt>What lit it</dt>
							<dd className="swatch">{ by }</dd>
						</div>
						<div>
							<dt>Reading</dt>
							<dd>
								{ minutes } { minutes === 1 ? 'minute' : 'minutes' }
							</dd>
						</div>
					</dl>
					<div className="text">
						{ text.slice( 0, middle ).map( paragraph ) }
						<figure className="said">
							<blockquote>
								<p>{ said.text }</p>
							</blockquote>
							<figcaption>{ said.by }</figcaption>
						</figure>
						{ text.slice( middle ).map( paragraph ) }
					</div>
					<p className="credit">
						Photo:{ ' ' }
						<a href={ `https://www.pexels.com/photo/${ pexels }/` }>Pexels</a>
					</p>
				</article>
				<Night slug={ slug } />
				<a
					className="next"
					href={ address( next.slug ) }
					data-story={ next.slug }
					style={ lit( next.n ) }
				>
					<img
						{ ...image( next.n, 'photos' ) }
						sizes="(max-width: 700px) 100vw, 45vw"
						alt=""
						loading="lazy"
					/>
					<span>
						<span className="then">
							Next, at <time>{ next.time }</time>
						</span>
						<strong>{ next.title }</strong>
						<span className="about">{ next.about }</span>
					</span>
				</a>
			</main>
		</>
	);
}
