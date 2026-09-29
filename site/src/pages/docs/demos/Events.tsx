import { useCallback, useRef, type CSSProperties } from 'react';
import { ShaderSlider, Slide } from '@/components/ShaderSlider';
import { Events as Said, type Tell } from '@/components/Pieces';
import { BUTTON } from '@/components/Frame';
import { controls, keyboard, wheel } from 'shaderslide/plugins';

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
				<ShaderSlider
					id="remote"
					label="Driven from outside"
					options={ { loop: true } }
					className="cards"
					style={ { '--ss-per-view': 2, '--ss-gap': '16px' } as CSSProperties }
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
				</ShaderSlider>
				<div className="grid content-start gap-4">
					<nav
						data-ss-for="remote"
						aria-label="Driven from outside"
						className="flex flex-wrap gap-2"
					>
						<button type="button" className={ BUTTON } data-ss-prev>
							prev()
						</button>
						<button type="button" className={ BUTTON } data-ss-next>
							next()
						</button>
						{ [ 0, 2, 4 ].map( ( n ) => (
							<button key={ n } type="button" className={ BUTTON } data-ss-to={ n }>
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
