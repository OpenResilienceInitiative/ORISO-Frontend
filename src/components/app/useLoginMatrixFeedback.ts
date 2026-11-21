import {
	type RefObject,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import './loginMatrixFeedback.scss';

type Scene = ReturnType<
	typeof import('./loginMatrixDissolve').startLoginMatrix
>;

const preference = () =>
	window.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced = () => preference()?.matches ?? false;
const subscribe = (notify: () => void) => {
	const query = preference();
	query?.addEventListener?.('change', notify);
	return () => query?.removeEventListener?.('change', notify);
};
const load = () => import('./loginMatrixDissolve');

export function warmLoginMatrix() {
	if (!reduced()) void load().catch(() => undefined);
}

/** Feedback never gates authentication. An error, a new attempt, or unmount restores the original translated nodes. */
export function useLoginMatrixFeedback(
	ref: RefObject<HTMLElement | null>,
	pending: boolean
) {
	const reduce = useSyncExternalStore(subscribe, reduced, () => true);
	const scene = useRef<Scene | null>(null);
	const [running, setRunning] = useState(false);
	const active = pending && !reduce;
	useLayoutEffect(() => {
		const host = ref.current;
		if (!host) return;
		host.dataset.matrixPhase = pending ? 'loading' : 'idle';
		return () => {
			delete host.dataset.matrixPhase;
		};
	}, [ref, pending]);

	useLayoutEffect(() => {
		const host = ref.current;
		const panel = host?.closest<HTMLElement>(
			'.stageLayout__contentWrapper'
		);
		if (!active || !panel || !host) return;
		let stopped = false;
		const canvas = document.createElement('canvas');
		canvas.className = 'loginMatrixCanvas';
		canvas.setAttribute('aria-hidden', 'true');
		void load()
			.then(({ startLoginMatrix }) => {
				if (stopped || host.dataset.matrixPhase !== 'loading') return;
				panel.classList.add('loginMatrixSheet');
				panel.append(canvas);
				scene.current = startLoginMatrix(canvas, host);
				setRunning(true);
			})
			.catch(() => {
				if (stopped) return;
				canvas.remove();
				panel.classList.remove('loginMatrixSheet');
			});
		return () => {
			stopped = true;
			scene.current?.dispose();
			scene.current = null;
			setRunning(false);
			canvas.remove();
			panel.classList.remove('loginMatrixSheet');
		};
	}, [active, ref]);
	return active && running;
}
