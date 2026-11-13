/**
 * A soft double knock, made in the browser (Frank, 2026-11-12: "einen
 * dezenten Ton … vielleicht einen Klopfton"). Two short low thuds, quiet, so
 * it reminds the host in a running call without startling anyone. Silent
 * where Web Audio is missing or blocked.
 */
export const playKnockTone = (volume = 0.35): void => {
	const AudioContextClass =
		globalThis.AudioContext ??
		(globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextClass) return;
	try {
		const context = new AudioContextClass();
		const knockAt = (start: number) => {
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(190, start);
			oscillator.frequency.exponentialRampToValueAtTime(90, start + 0.09);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
			oscillator.connect(gain).connect(context.destination);
			oscillator.start(start);
			oscillator.stop(start + 0.13);
		};
		const now = context.currentTime;
		knockAt(now + 0.01);
		knockAt(now + 0.19);
		window.setTimeout(
			() => void context.close().catch(() => undefined),
			600
		);
	} catch {
		/* No sound is fine: the wiggle still says it. */
	}
};
