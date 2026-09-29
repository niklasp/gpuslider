/**
 * What a slider can do besides moving its slides. Nothing of it is in the
 * core: a slider has what it is given.
 *
 *     import { createSlider } from 'gpuslider';
 *     import { controls, keyboard, autoplay } from 'gpuslider/plugins';
 *
 *     createSlider( element, {
 *         plugins: [ controls(), keyboard(), autoplay( 3500 ) ],
 *     } );
 *
 * All of them at once: `gpuslider/full`.
 */
export { controls } from './controls.js';
export { keyboard } from './keyboard.js';
export { wheel } from './wheel.js';
export { autoplay } from './autoplay.js';
export { videos } from './videos.js';
export { autoHeight } from './auto-height.js';
export { stack } from './stack.js';
export { progress } from './progress.js';
export { marquee } from './marquee.js';
export { thumbs } from './thumbs.js';
export { loading } from './loading.js';
