/**
 * The canvas layer and its effects.
 *
 *     import { createSlider } from 'gpuslider';
 *     import { gl, stretch } from 'gpuslider/gl';
 *
 *     createSlider( element, { plugins: [ gl( { effects: [ stretch() ] } ) ] } );
 */
export type { Effect } from './program.js';
export { gl } from './layer.js';
export { hit } from '../hit.js';
export * from './effects/index.js';
export * from './transitions/index.js';
