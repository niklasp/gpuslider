/**
 * Writes `src/components/icons.tsx`: the icons of Phosphor that the site
 * uses, in the weights it uses them in. The package has every weight of
 * an icon in its module, six times what is drawn.
 *
 * `node icons.mjs`
 */
import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const USED = {
	ArrowsOut: [ 'duotone' ],
	Atom: [ 'duotone' ],
	BracketsAngle: [ 'duotone' ],
	Cpu: [ 'duotone' ],
	MagicWand: [ 'duotone' ],
	PuzzlePiece: [ 'duotone' ],
	Shuffle: [ 'duotone' ],
	Spiral: [ 'duotone' ],
	GithubLogo: [ 'fill' ],
	ImageSquare: [ 'regular', 'fill' ],
	Swatches: [ 'regular', 'fill' ],
};

let out = `// Written by \`node icons.mjs\` from @phosphor-icons/react. Do not edit.
import type { SVGProps } from 'react';

export type IconProps = Omit< SVGProps< SVGSVGElement >, 'weight' > & {
	size?: number;
	weight?: 'regular' | 'fill' | 'duotone';
};
export type Icon = ( props: IconProps ) => React.JSX.Element;

const make =
	( weights: Partial< Record< NonNullable< IconProps[ 'weight' ] >, string > > ): Icon =>
	( { size = 16, weight = 'regular', ...props } ) => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={ size }
			height={ size }
			fill="currentColor"
			viewBox="0 0 256 256"
			{ ...props }
			dangerouslySetInnerHTML={ { __html: weights[ weight ]! } }
		/>
	);
`;
for ( const [ name, weights ] of Object.entries( USED ) ) {
	const { default: defs } = await import(
		`./node_modules/@phosphor-icons/react/dist/defs/${ name }.es.js`
	);
	const drawn = weights
		.map(
			( weight ) =>
				`${ weight }: '${ renderToStaticMarkup(
					createElement( 'svg', null, defs.get( weight ) )
				).replace( /^<svg>|<\/svg>$/g, '' ) }'`
		)
		.join( ', ' );
	out += `\nexport const ${ name } = make( { ${ drawn } } );\n`;
}
writeFileSync( 'src/components/icons.tsx', out );
