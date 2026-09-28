/**
 * The canvas layer and its effects.
 *
 *     import { createSlider } from 'shaderslide';
 *     import { gl, warp } from 'shaderslide/gl';
 *
 *     createSlider( element, { layers: [ gl( { effects: [ warp() ] } ) ] } );
 */
export { gl } from './layer.js';
export * from './effects/index.js';
export * from './transitions/index.js';
