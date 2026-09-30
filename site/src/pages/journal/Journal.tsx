import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '@fontsource-variable/funnel-display';
import 'gpuslider/style.css';
import './journal.css';
import { createSlider } from 'gpuslider';
import { controls, keyboard, wheel } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch } from 'gpuslider/effects';
import { image, photo } from '@/lib/media';
import { drawnBy, layer } from '../mount';
import { STORIES } from './stories';

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
				<a href="/examples/">gpu slider</a>
				<span>Journal{ by && ` · drawn by ${ by }` }</span>
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

/** A story: its picture over the whole width, and what it says. */
export function Story( { slug }: { slug: string } ) {
	const at = STORIES.findIndex( ( story ) => story.slug === slug );
	const { n, title, about, text, pexels } = STORIES[ at ];
	const next = STORIES[ ( at + 1 ) % STORIES.length ];
	const { style, ...picture } = image( n, 'photos' );

	return (
		<>
			<header>
				<a href="/examples/journal/">Afterlight</a>
				<a href="/examples/">gpu slider</a>
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
					{ text.map( ( paragraph ) => (
						<p key={ paragraph.slice( 0, 20 ) }>{ paragraph }</p>
					) ) }
					<p className="credit">
						Photo:{ ' ' }
						<a href={ `https://www.pexels.com/photo/${ pexels }/` }>Pexels</a>
					</p>
				</article>
				<nav aria-label="More stories">
					<a href="/examples/journal/">All stories</a>
					<a href={ address( next.slug ) }>
						<span>Next</span> { next.title }
					</a>
				</nav>
			</main>
		</>
	);
}
