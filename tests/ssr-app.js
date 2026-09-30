/**
 * A page of sliders in React, as a server renders it and a browser
 * hydrates it (`ssr.spec.js`): a row of several, and a stack with the
 * canvas. The same file on both sides, as in Next.js.
 */
import { createElement as h } from 'react';
import { Slider, Slide } from '../src/react.js';
import { controls, stack } from '../src/plugins/index.js';
import { canvas } from '../src/canvas.js';
import { stretch } from '../src/effects.js';

const images = [ 1, 2, 3, 4, 5 ];

const slides = ( eager ) =>
	images.map( ( n, i ) =>
		h(
			Slide,
			{ key: n },
			h( 'img', {
				className: 'gs-media',
				src: `/media/${ n }-960.avif`,
				width: 960,
				height: 1200,
				alt: `Colour field ${ n }`,
				loading: eager && i === 0 ? 'eager' : 'lazy',
			} )
		)
	);

const arrows = h(
	'div',
	null,
	h( 'button', { type: 'button', 'data-gs-prev': '', 'aria-label': 'Previous' }, '‹' ),
	h( 'button', { type: 'button', 'data-gs-next': '', 'aria-label': 'Next' }, '›' )
);

export function App() {
	return h(
		'main',
		null,
		h(
			Slider,
			{
				id: 'row',
				'aria-label': 'Row',
				loop: true,
				style: { '--gs-per-view': 3, '--gs-gap': '12px' },
				plugins: [ controls(), canvas( { effects: [ stretch() ] } ) ],
				around: arrows,
			},
			slides( true )
		),
		h(
			Slider,
			{
				id: 'stack',
				'aria-label': 'Stack',
				className: 'gs-stack',
				plugins: [ controls(), stack(), canvas( { eager: true } ) ],
				around: arrows,
			},
			slides( false )
		)
	);
}
