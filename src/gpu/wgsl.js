/**
 * Says in WGSL what an effect says in GLSL.
 *
 * The effects are written once, in GLSL. WebGPU reads WGSL, which has the
 * same functions under the same names and another way to write nearly
 * everything else. What is translated here is what effects are made of:
 *
 *     float, int, bool, vec2 to vec4, mat2 to mat4, as types and as makers
 *     variables, constants and functions; `for`, `if`, `return`
 *     a ? b : c
 *     mod( a, b ), atan( y, x ), inversesqrt, dFdx, dFdy
 *
 * What has no translation, and is therefore not used by the effects that
 * come with the library:
 *
 *     `out` and `inout`, structs, arrays, the preprocessor
 *     functions that take a vector and a number where WGSL wants two
 *     vectors: `max( v, 0.0 )` is `max( v, vec2( 0.0 ) )` in both
 *     writing to several parts of a vector at once: `p.xy = q` is
 *     `p = vec3( q, p.z )` in both
 *
 * WGSL keeps many words to itself, `from` and `filter` among them, that
 * are good names in GLSL. So every variable gets a `_` behind its name,
 * which no word of WGSL has. Functions keep their names.
 */

const TYPES = {
	void: '',
	float: 'f32',
	int: 'i32',
	bool: 'bool',
	vec2: 'vec2f',
	vec3: 'vec3f',
	vec4: 'vec4f',
	mat2: 'mat2x2f',
	mat3: 'mat3x3f',
	mat4: 'mat4x4f',
};
const TYPE = Object.keys( TYPES ).join( '|' );

const OTHER = { inversesqrt: 'inverseSqrt', dFdx: 'dpdx', dFdy: 'dpdy' };

/**
 * @param {string} code Code.
 * @param {number} from Where a bracket opens.
 * @return {number} Where it closes.
 */
function closing( code, from ) {
	let depth = 0;
	for ( let i = from; i < code.length; i++ ) {
		depth += code[ i ] === '(' ? 1 : 0;
		depth -= code[ i ] === ')' ? 1 : 0;
		if ( ! depth ) {
			return i;
		}
	}
	return code.length;
}

/**
 * @param {string} list What is between the brackets of a call.
 * @return {string[]} Its arguments.
 */
function split( list ) {
	const out = [];
	let depth = 0;
	let from = 0;
	for ( let i = 0; i <= list.length; i++ ) {
		depth += list[ i ] === '(' ? 1 : 0;
		depth -= list[ i ] === ')' ? 1 : 0;
		if ( i === list.length || ( list[ i ] === ',' && ! depth ) ) {
			out.push( list.slice( from, i ).trim() );
			from = i + 1;
		}
	}
	return out;
}

/**
 * Writes the calls of a function another way.
 *
 * @param {string}   code Code.
 * @param {string}   name Name of the function.
 * @param {Function} say  Gets the arguments, returns what to write.
 * @return {string} Code.
 */
function calls( code, name, say ) {
	const call = new RegExp( `(?<![.\\w])${ name }\\s*\\(`, 'g' );
	let found;
	while ( ( found = call.exec( code ) ) ) {
		const open = found.index + found[ 0 ].length - 1;
		const close = closing( code, open );
		const said = say( split( code.slice( open + 1, close ) ) );
		code = code.slice( 0, found.index ) + said + code.slice( close + 1 );
		call.lastIndex = found.index + ( said.startsWith( name ) ? name.length : 0 );
	}
	return code;
}

/**
 * a ? b : c, as `select( c, b, a )`. Both b and c are worked out, which
 * is what a shader does anyway.
 *
 * @param {string} code Code.
 * @return {string} Code.
 */
function choices( code ) {
	let at;
	// The last one first: what is in its branches has no other.
	while ( ( at = code.lastIndexOf( '?' ) ) >= 0 ) {
		// Back to where the condition begins.
		let depth = 0;
		let from = at;
		while ( from > 0 ) {
			const c = code[ from - 1 ];
			depth += c === ')' ? 1 : 0;
			depth -= c === '(' ? 1 : 0;
			if (
				depth < 0 ||
				( ! depth &&
					( /[,;{}?:]/.test( c ) ||
						( c === '=' && ! /[=!<>]/.test( code[ from - 2 ] ) ) ||
						/\breturn$/.test( code.slice( 0, from ) ) ) )
			) {
				break;
			}
			// `==`, `<=`: part of the condition.
			from -= c === '=' && ! depth ? 2 : 1;
		}
		// On to where the branches end.
		depth = 0;
		let colon = at;
		let to = at + 1;
		for ( ; to < code.length; to++ ) {
			const c = code[ to ];
			depth += c === '(' ? 1 : 0;
			depth -= c === ')' ? 1 : 0;
			if ( depth < 0 || ( ! depth && /[,;]/.test( c ) ) ) {
				break;
			}
			if ( c === ':' && ! depth && colon === at ) {
				colon = to;
			}
		}
		code =
			code.slice( 0, from ) +
			` select( ${ code.slice( colon + 1, to ).trim() }, ${ code
				.slice( at + 1, colon )
				.trim() }, ${ code.slice( from, at ).trim() } )` +
			code.slice( to );
	}
	return code;
}

/**
 * @param {string} glsl Functions, constants and what is in them.
 * @return {string} The same in WGSL.
 */
export function wgsl( glsl ) {
	let code = glsl.replace( /\/\*[\s\S]*?\*\/|\/\/.*/g, '' );
	code = choices( code );
	code = calls( code, 'mod', ( [ a, b ] ) => `( ( ${ a } ) - ( ${ b } ) * floor( ( ${ a } ) / ( ${ b } ) ) )` );
	code = calls( code, 'atan', ( all ) => `atan${ all[ 1 ] ? 2 : '' }( ${ all } )` );

	// Functions, whose parameters can be written to in GLSL, and what is
	// declared.
	const declared = {};
	code = code.replace(
		new RegExp(
			`(const\\s+)?\\b(${ TYPE })\\s+(\\w+)\\s*(\\(([^)]*)\\)\\s*\\{)?`,
			'g'
		),
		( all, constant, type, name, call, list ) => {
			if ( ! call ) {
				declared[ name ] = `${ name }_`;
				return `${ constant ? 'const' : 'var' } ${ name }: ${ TYPES[ type ] }`;
			}
			const given = split( list )
				.filter( Boolean )
				.map( ( one ) => one.split( /\s+/ ).slice( -2 ) );
			given.forEach( ( [ , as ] ) => ( declared[ as ] = `${ as }_` ) );
			return (
				`fn ${ name }( ${ given.map(
					( [ kind, as ] ) => `${ as }_0: ${ TYPES[ kind ] }`
				) } )${ TYPES[ type ] && ` -> ${ TYPES[ type ] }` } {\n` +
				given.map( ( [ , as ] ) => `var ${ as } = ${ as }_0;` ).join( '' )
			);
		}
	);

	// What is left of the types makes values.
	return rename( code, declared, '(?!\\s*\\()' )
		.replace( new RegExp( `\\b(${ TYPE })\\b(?=\\s*\\()`, 'g' ), ( type ) => TYPES[ type ] )
		.replace( /\b(inversesqrt|dFd[xy])\b/g, ( name ) => OTHER[ name ] );
}

/**
 * Gives names in a piece of code other names: what `#define` does in GLSL.
 *
 * @param {string}                 code  Code.
 * @param {Record<string, string>} names Names and what to write for them.
 * @param {string}                 [not] What must not follow a name, as
 *                                       the source of a regular expression.
 * @return {string} Code.
 */
export function rename( code, names, not = '' ) {
	const all = Object.keys( names );
	return all.length
		? code.replace(
				new RegExp( `(?<![.\\w])(${ all.join( '|' ) })\\b${ not }`, 'g' ),
				( name ) => names[ name ]
		  )
		: code;
}
