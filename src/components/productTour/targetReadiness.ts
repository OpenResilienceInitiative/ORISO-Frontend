export interface WaitForTargetOptions {
	timeoutMs: number;
	pollMs?: number;
}

/**
 * Waits until a selector matches an element or the bounded timeout elapses.
 * Resolves `true` when found, `false` on timeout — it never rejects, so a
 * missing tour target can be skipped without trapping the user in an overlay.
 */
export const waitForTarget = (
	selector: string,
	{ timeoutMs, pollMs = 50 }: WaitForTargetOptions
): Promise<boolean> =>
	new Promise((resolve) => {
		const deadline = Date.now() + timeoutMs;
		const check = () => {
			let target: Element | null;
			try {
				target = document.querySelector(selector);
			} catch {
				// An invalid selector can never match: keep the never-reject
				// contract and let the caller skip the step safely.
				resolve(false);
				return;
			}
			if (target) {
				resolve(true);
			} else if (Date.now() >= deadline) {
				resolve(false);
			} else {
				setTimeout(check, pollMs);
			}
		};
		check();
	});
