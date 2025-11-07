import { Mode } from '@/types';
import defaultMode from './default';

/** get the deployment mode configuration based on the mode input */
const get = (mode: string): Mode => {
    switch (mode) {
        case 'default':
            return defaultMode;
        default:
            return defaultMode;
    }
};

export default { get };
