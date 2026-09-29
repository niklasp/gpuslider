import { useEffect, useRef } from 'react';

/** What the page has in its HTML, and no more. */
const HTML = `<div class="ss cards" aria-label="Photos" style="--ss-per-view: 2.5; --ss-gap: 16px"
	data-ss='{ "loop": true }'
	data-ss-canvas="stretch split">
	<div class="ss-track">
${ [ 3, 5, 7, 1, 8, 2 ]
	.map(
		( n ) => `		<div class="ss-slide card wide">
			<img class="ss-media" src="/media/${ n }-960.avif" alt="Colour field ${ n }" loading="lazy" draggable="false">
		</div>`
	)
	.join( '\n' ) }
	</div>
	<button class="arrow" data-ss-prev aria-label="Previous slide">‹</button>
	<button class="arrow" data-ss-next aria-label="Next slide">›</button>
</div>`;

/**
 * A slider that `auto.js` has made of attributes. React writes the HTML
 * and leaves it alone.
 */
export default function Html() {
	const root = useRef< HTMLDivElement >( null );
	useEffect( () => {
		import( 'shaderslide/auto' ).then( ( { auto } ) => auto( root.current! ) );
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
				This slider is HTML with <code>data-ss</code> and{ ' ' }
				<code>data-ss-canvas="stretch split"</code>, and <code>auto.js</code>{ ' ' }
				has made it. The canvas is loaded when the slider is used.
			</p>
		</>
	);
}
