import { useCallback, useRef, type CSSProperties } from 'react';
import { GpuSlider, Slide } from '@/components/GpuSlider';
import { Events as Said, type Tell } from '@/components/Pieces';
import { BUTTON } from '@/components/Frame';
import { controls, keyboard, wheel } from 'gpuslider/plugins';

/** Buttons that are not in the slider, and what the slider says. */
export default function Events() {
	const tell: Tell = useRef( null );
	const heard = useCallback( ( name: string, detail: unknown ) => {
		const said =
			typeof detail === 'number' || typeof detail === 'boolean'
				? ` ${ detail }`
				: Array.isArray( detail ) && typeof detail[ 0 ] === 'number'
				? ` ${ detail.join( ', ' ) }`
				: '';
		tell.current?.( `${ name }${ said }` );
	}, [] );
	return (
		<>
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
				<GpuSlider
					id="remote"
					label="Driven from outside"
					options={ { loop: true } }
					className="cards"
					style={ { '--gs-per-view': 2, '--gs-gap': '16px' } as CSSProperties }
					made=""
					measured=""
					heard={ heard }
					plugins={ () => [ controls(), keyboard(), wheel() ] }
					bare
				>
					{ [ 2, 4, 6, 8, 1, 3 ].map( ( n ) => (
						<Slide
							key={ n }
							image={ n }
							alt={ `Colour field ${ n }` }
							className="card wide"
							sizes="(min-width: 768px) 30vw, 50vw"
						/>
					) ) }
				</GpuSlider>
				<div className="grid content-start gap-4">
					<nav
						data-gs-for="remote"
						aria-label="Driven from outside"
						className="flex flex-wrap gap-2"
					>
						<button type="button" className={ BUTTON } data-gs-prev>
							prev()
						</button>
						<button type="button" className={ BUTTON } data-gs-next>
							next()
						</button>
						{ [ 0, 2, 4 ].map( ( n ) => (
							<button key={ n } type="button" className={ BUTTON } data-gs-to={ n }>
								to( { n } )
							</button>
						) ) }
					</nav>
					<Said tell={ tell } />
				</div>
			</div>
			<p className="note">
				The list is what the slider says while it is used, the newest at the
				top. Every event but <code>frame</code>, which comes with every frame
				of a move.
			</p>
		</>
	);
}
