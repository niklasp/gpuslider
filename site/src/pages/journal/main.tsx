import { mount } from '../mount';
import { Journal, Story } from './Journal';
import { STORIES } from './stories';

// /examples/journal/ is the list, /examples/journal/<story>/ a story.
const slug = location.pathname.match( /\/journal\/([^/]+)\/$/ )?.[ 1 ];

mount(
	slug && STORIES.some( ( story ) => story.slug === slug ) ? (
		<Story slug={ slug } />
	) : (
		<Journal />
	)
);
