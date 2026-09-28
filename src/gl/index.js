/**
 * The canvas layer and its effects.
 *
 *     import { createSlider } from 'shaderslide';
 *     import { gl, stretch } from 'shaderslide/gl';
 *
 *     createSlider( element, { plugins: [ gl( { effects: [ stretch() ] } ) ] } );
 */
/**
 * @typedef {import('./program.js').Effect} Effect
 */
export { gl } from './layer.js';
export * from './effects/index.js';
export * from './transitions/index.js';
