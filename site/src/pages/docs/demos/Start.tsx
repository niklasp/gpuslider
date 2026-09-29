import { type CSSProperties } from 'react';
import { ShaderSlider, Slide } from '@/components/ShaderSlider';
import { controls, keyboard } from 'shaderslide/plugins';

/** The core, arrows and keys: the first piece of code of the page. */
export default function Start() {
	return (
		<>
			<ShaderSlider
				id="start"
				label="Photos"
				options={ { loop: true } }
				className="cards"
				style={ { '--ss-per-view': 3, '--ss-gap': '16px' } as CSSProperties }
				made=""
				measured=""
				plugins={ () => [ controls(), keyboard() ] }
			>
				{ [ 1, 2, 3, 4, 5, 6 ].map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="card wide"
						sizes="(max-width: 640px) 77vw, 30vw"
					/>
				) ) }
			</ShaderSlider>
			<p className="note">
				The core, <code>controls()</code> and <code>keyboard()</code>, and
				nothing else: the page draws it. Drag it, or use the arrows and the
				keys.
			</p>
		</>
	);
}
