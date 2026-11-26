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
	if (!reduced())
		void load()
			.then(({ warmSigns }) => warmSigns())
			.catch(() => undefined);
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
		if (!active || !host) return;
		let stopped = false;
		void load()
			.then(({ startLoginMatrix }) => {
				if (stopped || host.dataset.matrixPhase !== 'loading') return;
				scene.current = startLoginMatrix(host);
				setRunning(true);
			})
			.catch(() => undefined);
		return () => {
			stopped = true;
			scene.current?.dispose();
			scene.current = null;
			setRunning(false);
		};
	}, [active, ref]);
	return active && running;
}
