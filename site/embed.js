/**
 * Which pages can be embedded in other sites by their link, and how large:
 * the first page, every example and the playground; not the docs, which
 * are read, not shown. The Worker answers oEmbed for them (`worker.js`),
 * and the build says so in their head (`prerender.mjs`).
 *
 * What a page is set to travels with it: `?<name>=<value>` is in the link,
 * and so in the frame.
 */
export const embeddable = ( path ) =>
	/^\/(?:examples\/[a-z-]+\/(?:[a-z-]+\/)?|playground\/)?$/.test( path );

// The examples that are scrolled through want a taller frame than a slider
// does.
const TALL = /^\/examples\/(?:reel|orbit|fold|tape|wave)\//;

/** The size of the frame, made to fit in `max`, at its own proportion. */
export function frame( path, max = {} ) {
	let width = 800;
	let height = TALL.test( path ) ? 600 : 450;
	const ratio = width / height;
	if ( max.width > 0 && width > max.width ) {
		width = Math.round( max.width );
		height = Math.round( width / ratio );
	}
	if ( max.height > 0 && height > max.height ) {
		height = Math.round( max.height );
		width = Math.round( height * ratio );
	}
	return { width, height };
}
