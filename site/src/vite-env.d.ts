/// <reference types="vite/client" />

// The README of the library as pages: see `docs.ts`.
declare module 'virtual:docs' {
	export const pages: {
		name: string;
		slug: string;
		address: string;
		title: string;
		lead: string;
		headings: { id: string; text: string }[];
	}[];
	/** Pieces of code of the README, as HTML. */
	export const code: Record< 'script' | 'canvas' | 'react' | 'html', string >;
	/** The pages as HTML, by their slug. */
	export const load: Record< string, () => Promise< { default: string } > >;
}

declare module 'virtual:docs/*' {
	const html: string;
	export default html;
}
