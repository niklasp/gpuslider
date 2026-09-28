import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = document.getElementById( 'root' )!;
const app = (
	<StrictMode>
		<App />
	</StrictMode>
);

// The build has rendered the page already (see `prerender.mjs`).
if ( root.firstElementChild ) {
	hydrateRoot( root, app );
} else {
	createRoot( root ).render( app );
}
