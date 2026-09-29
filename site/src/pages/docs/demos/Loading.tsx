import { type CSSProperties } from 'react';
import 'shaderslide/loading.css';
import { Loads } from '@/components/Pieces';
import { controls, keyboard, wheel } from 'shaderslide/plugins';

/** Pictures that load again, and what `loading()` says meanwhile. */
export default function Loading() {
	return (
		<>
			<Loads
				options={ { loop: true } }
				style={ { '--ss-per-view': 2.5, '--ss-gap': '12px' } as CSSProperties }
				made=""
				measured=""
				plugins={ () => [ controls(), keyboard(), wheel() ] }
			/>
			<p className="note">
				The button asks for the pictures again, under another address. The
				screen is the one that comes with the library, shown for 700 ms at
				least; the list is what the events said.
			</p>
		</>
	);
}
