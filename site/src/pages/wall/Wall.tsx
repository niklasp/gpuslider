import { useEffect, useRef } from 'react';
import 'gpuslider/style.css';
import './wall.css';
import pictures from '@/lib/wall.json';
import { wall } from './sliders';

const ROWS = 7;
const IN_A_ROW = 8;
// No picture twice in a row: none of them has a part in common with 24.
const STEPS = [ 5, 7, 11, 13, 17, 19, 23 ];

const rows = Array.from( { length: ROWS }, ( _, row ) =>
	Array.from(
		{ length: IN_A_ROW },
		( __, i ) => ( row * 7 + i * STEPS[ row ] ) % pictures.length
	)
);

/**
 * A wall of pictures behind thick glass, without an end in any direction.
 * React renders the rows, `wall()` makes sliders of them.
 */
export default function Wall() {
	const root = useRef< HTMLElement >( null );
	const intro = useRef< HTMLDivElement >( null );
	const said = useRef< HTMLSpanElement >( null );

	useEffect(
		() => wall( root.current!, intro.current!, said.current! ),
		[]
	);

	return (
		<>
			<div
				ref={ intro }
				id="intro"
				className="intro gs-loading"
				aria-label="The wall is loading"
			>
				<svg
					className="mark"
					viewBox="0 0 64 64"
					width="64"
					height="64"
					aria-hidden="true"
				>
					<rect x="6" y="14" width="40" height="28" rx="7" />
					<rect x="18" y="22" width="40" height="28" rx="7" />
				</svg>
				<p>
					<span data-gs-loaded>0</span>
					<span> %</span>
				</p>
			</div>

			<main
				ref={ root }
				id="wall"
				className="gs wall"
				aria-label="A wall of pictures. Drag it, or use the arrow keys."
			>
				<div className="gs-track">
					{ rows.map( ( row, at ) => (
						<div className="gs-slide" key={ at }>
							<div
								className="gs row"
								aria-label={ `Row ${ at + 1 } of ${ ROWS }` }
							>
								<div className="gs-track">
									{ row.map( ( n ) => (
										<div className="gs-slide" key={ n }>
											<img
												className="gs-media"
												src={ `/media/wall/${ String( n + 1 ).padStart(
													2,
													'0'
												) }.jpg` }
												width="840"
												height="560"
												alt={ `${ pictures[ n ].title }. ${ pictures[ n ].line }` }
												draggable={ false }
											/>
										</div>
									) ) }
								</div>
							</div>
						</div>
					) ) }
				</div>
			</main>

			<footer>
				<a href="/examples/">gpu slider</a>
				<span ref={ said } id="said">
					Drag the wall
				</span>
			</footer>
		</>
	);
}
