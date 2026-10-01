import { mount } from '../mount';
import Wave, { waveOf } from './Wave';

// /examples/wave/ is the first stage, /examples/wave/<stage>/ another.
mount( <Wave stage={ waveOf( location.pathname ) } /> );
