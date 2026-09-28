/**
 * Makes the GLSL in a JavaScript file small: the shaders are text, which no
 * bundler of a page touches.
 *
 * Only what is between backticks is looked at, and of that only files that
 * say so with a first line of `// glsl` are given here.
 */

const KEEP = /^\s*#/;

/**
 * @param {string} text GLSL, or a part of it.
 * @return {string} The same without comments and without the spaces that
 *                  nobody needs.
 */
export function compact( text ) {
	return text
		.replace( /\/\*[\s\S]*?\*\//g, '' )
		.split( '\n' )
		.map( ( line ) => {
			line = line.replace( /\/\/.*$/, '' ).trim();
			if ( KEEP.test( line ) ) {
				// The preprocessor reads lines and spaces.
				return `\n${ line.replace( /\s+/g, ' ' ) }\n`;
			}
			return (
				line
					.replace( /\s+/g, ' ' )
					.replace( /\s*([(){}\[\],;=*\/<>?:!&|])\s*/g, '$1' )
					// Not `a - -b`, which would be `a--b`.
					.replace( /\s*([+-])\s*(?![+-])/g, '$1' )
					.replace( /([+-]) ([+-])/g, '$1 $2' )
			);
		} )
		.join( '\u0000' )
		// Lines end where a statement ends. Where not, a space keeps two
		// words apart.
		.replace( /\u0000+/g, '\u0000' )
		.replace( /([;{}(,=+\-*\/<>?:&|])\u0000/g, '$1' )
		.replace( /\u0000([;{}),=+\-*\/<>?:&|])/g, '$1' )
		.replace( /\n\u0000|\u0000\n/g, '\n' )
		.replace( /\u0000/g, ' ' )
		.replace( /\n+/g, '\n' );
}

/**
 * @param {string} source JavaScript.
 * @return {string} The same, with what is between backticks made small.
 */
export function compactIn( source ) {
	let out = '';
	let i = 0;
	while ( i < source.length ) {
		const c = source[ i ];
		// Comments and plain strings may have a backtick in them.
		if ( c === '/' && source[ i + 1 ] === '/' ) {
			const end = source.indexOf( '\n', i );
			out += source.slice( i, end < 0 ? source.length : end );
			i = end < 0 ? source.length : end;
		} else if ( c === '/' && source[ i + 1 ] === '*' ) {
			const end = source.indexOf( '*/', i ) + 2;
			out += source.slice( i, end );
			i = end;
		} else if ( c === "'" || c === '"' ) {
			let end = i + 1;
			while ( source[ end ] !== c ) {
				end += source[ end ] === '\\' ? 2 : 1;
			}
			out += source.slice( i, end + 1 );
			i = end + 1;
		} else if ( c === '`' ) {
			// The text, without what JavaScript puts into it.
			let text = '';
			const holes = [];
			i++;
			while ( source[ i ] !== '`' ) {
				if ( source[ i ] === '$' && source[ i + 1 ] === '{' ) {
					let depth = 1;
					let end = i + 2;
					while ( depth ) {
						depth += source[ end ] === '{' ? 1 : 0;
						depth -= source[ end ] === '}' ? 1 : 0;
						end++;
					}
					holes.push( source.slice( i, end ) );
					text += `HOLE_${ holes.length - 1 }_`;
					i = end;
				} else {
					text += source[ i++ ];
				}
			}
			i++;
			const small = /[;{}]|#define|#version/.test( text )
				? compact( text )
				: text;
			out +=
				'`' +
				small.replace( /HOLE_(\d+)_/g, ( _, n ) => holes[ n ] ) +
				'`';
		} else {
			out += c;
			i++;
		}
	}
	return out;
}
