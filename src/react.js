/**
 * The slider in React: React renders the slides, the slider moves them.
 *
 *     import { useSlider } from 'gpuslider/react';
 *     import { controls } from 'gpuslider/plugins';
 *
 *     function Photos( { photos, loop } ) {
 *         const [ ref, slider ] = useSlider(
 *             { loop, plugins: [ controls() ] },
 *             [ loop ]
 *         );
 *         return (
 *             <div className="gs" ref={ ref } aria-label="Photos">
 *                 <div className="gs-track">
 *                     { photos.map( ( photo ) => (
 *                         <div className="gs-slide" key={ photo.src }>
 *                             <img className="gs-media" { ...photo } />
 *                         </div>
 *                     ) ) }
 *                 </div>
 *                 <button onClick={ () => slider?.next() }>Next</button>
 *             </div>
 *         );
 *     }
 *
 * Slides that React adds or removes are seen by the slider itself. What is
 * imported is what is in the bundle: this file, the core, and the plugins
 * and effects that are named.
 */
import { useEffect, useRef, useState } from 'react';
import { createSlider } from './index.js';

/**
 * @param {import('./index.js').Options} [options] Options of the slider,
 *                                                 with its plugins.
 * @param {unknown[]}                    [remake]  The slider is made again
 *                                                 when one of these
 *                                                 changes, as the
 *                                                 dependencies of an
 *                                                 effect. It stays at its
 *                                                 slide.
 * @return {[ import('react').RefObject<any>, import('./index.js').Slider | null ]}
 *         The ref for the element of the slider, and the slider once it is
 *         made.
 */
export function useSlider( options = {}, remake = [] ) {
	const ref = useRef( null );
	const at = useRef( options.start || 0 );
	const [ slider, set ] = useState(
		/** @type {import('./index.js').Slider | null} */ ( null )
	);
	useEffect( () => {
		const made = createSlider( ref.current, {
			...options,
			start: at.current,
		} );
		set( made );
		return () => {
			at.current = made.index;
			made.destroy();
			set( null );
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, remake );
	return [ ref, slider ];
}
