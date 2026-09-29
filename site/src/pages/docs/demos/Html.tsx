import { useEffect, useRef } from 'react';

/** What the page has in its HTML, and no more. */
const HTML = `<div class="gs cards" aria-label="Photos" style="--gs-per-view: 2.5; --gs-gap: 16px"
	data-gs='{ "loop": true }'
	data-gs-canvas="stretch split">
	<div class="gs-track">
${ [ 3, 5, 7, 1, 8, 2 ]
	.map(
		( n ) => `		<div class="gs-slide card wide">
			<img class="gs-media" src="/media/${ n }-960.avif" alt="Colour field ${ n }" loading="lazy" draggable="false">
		</div>`
	)
	.join( '\n' ) }
	</div>
	<button class="arrow" data-gs-prev aria-label="Previous slide">‹</button>
	<button class="arrow" data-gs-next aria-label="Next slide">›</button>
</div>`;

/**
 * A slider that `auto.js` has made of attributes. React writes the HTML
 * and leaves it alone.
 */
export default function Html() {
	const root = useRef< HTMLDivElement >( null );
	useEffect( () => {
		import( 'gpuslider/auto' ).then( ( { auto } ) => auto( root.current! ) );
	}, [] );
	return (
		<>
			<div
				ref={ root }
				id="written"
				className="min-w-0"
				dangerouslySetInnerHTML={ { __html: HTML } }
			/>
			<p className="note">
				This slider is HTML with <code>data-gs</code> and{ ' ' }
				<code>data-gs-canvas="stretch split"</code>, and <code>auto.js</code>{ ' ' }
				has made it. The canvas is loaded when the slider is used.
			</p>
		</>
	);
}
