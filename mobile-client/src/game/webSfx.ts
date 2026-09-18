import { Asset } from 'expo-asset';

/**
 * Web-only effects over the Web Audio API.
 *
 * expo-audio's web player is one <audio> element per sound and drops the
 * promise `media.play()` returns. iOS Safari refuses any element that has not
 * itself been played inside a gesture, so robot-triggered cues surfaced as
 * uncatchable NotAllowedErrors, and unmuting a pre-unlocked element outside a
 * gesture pauses it (AbortError). One AudioContext resumed on any gesture
 * unlocks every sound at once and never rejects a play.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;
const buffers = new Map<number, Promise<AudioBuffer | null>>();

function context(): Ctx | null {
    if (ctx) return ctx;
    if (typeof window === 'undefined') return null;
    const C: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    return ctx;
}

function load(c: Ctx, mod: number): Promise<AudioBuffer | null> {
    let buffer = buffers.get(mod);
    if (!buffer) {
        buffer = fetch(Asset.fromModule(mod).uri)
            .then((r) => r.arrayBuffer())
            .then((data) => c.decodeAudioData(data))
            .catch(() => null);
        buffers.set(mod, buffer);
    }
    return buffer;
}

let listening = false;

/** Installs the gesture listeners once per page. They stay installed because
 *  iOS suspends ("interrupts") the context again after backgrounding. */
export function armWebAudio(sounds: number[]) {
    if (listening || typeof document === 'undefined') return;
    listening = true;
    const resume = () => {
        const c = context();
        if (!c) return;
        if (c.state !== 'running') void c.resume().catch(() => {});
        sounds.forEach((mod) => void load(c, mod));
    };
    (['pointerdown', 'keydown', 'touchend'] as const).forEach((e) =>
        document.addEventListener(e, resume, { capture: true, passive: true }),
    );
}

export function playWebSfx(mod: number, volume: number) {
    const c = ctx;
    // Before the first gesture there is nothing to play into; stay silent
    // rather than queue cues that would all fire at once on the first tap.
    if (!c || c.state !== 'running') return;
    void load(c, mod).then((buffer) => {
        if (!buffer) return;
        const source = c.createBufferSource();
        source.buffer = buffer;
        const gain = c.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(c.destination);
        source.start();
    });
}
