import type { Call } from './useWebRTC';
import { useMediaQuery } from './useMediaQuery';

export function useSeatCameras(call: Call) {
    const roomy = useMediaQuery('(min-width: 1100px) and (min-height: 780px)');
    return call.status === 'on' && roomy && (call.preferences.layout === 'auto' || call.preferences.layout === 'seats');
}
