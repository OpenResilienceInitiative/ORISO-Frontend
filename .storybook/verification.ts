import { captureStorybookAnimationCleanup } from './storybookAnimationCleanup';
import {
	createVerificationRecorder,
	type ExpectedVerificationFailure
} from './verificationIntegrity';

interface StoryVerificationContext {
	id?: string;
	declaredNeedsData?: boolean;
	cleanup?: () => void | Promise<void>;
}
interface StoryVerificationEvidence {
	storyId?: string;
	classification: 'story' | 'declared-needs-data';
}
type RecordEvidence = (evidence: StoryVerificationEvidence) => void;
let activeCompletion: ((record?: RecordEvidence) => Promise<void>) | undefined;
let activeRecorder: ReturnType<typeof createVerificationRecorder> | undefined;

export const recordUnexpectedRequest = (request: Request) => {
	const message = `${request.method} ${request.url}`;
	if (activeRecorder) activeRecorder.record('unexpected-request', message);
	throw new Error(
		`Unexpected product API request: ${message}. Add a precise story fixture for this request.`
	);
};

const snapshotAttributes = (element: HTMLElement) => {
	const attributes = [...element.attributes].map(
		({ name, value }) => [name, value] as const
	);
	return () => {
		[...element.attributes].forEach(({ name }) =>
			element.removeAttribute(name)
		);
		attributes.forEach(([name, value]) =>
			element.setAttribute(name, value)
		);
	};
};

const snapshotStorage = (storage: Storage) => {
	const entries = Array.from({ length: storage.length }, (_, index) =>
		storage.key(index)
	)
		.filter((key): key is string => key !== null)
		.map((key) => [key, storage.getItem(key) ?? ''] as const);
	return () => {
		storage.clear();
		entries.forEach(([key, value]) => storage.setItem(key, value));
	};
};

export const beginStoryVerification = (
	expected: ExpectedVerificationFailure[] = [],
	context: StoryVerificationContext = {}
) => {
	const releaseAnimations = captureStorybookAnimationCleanup();
	const recorder = createVerificationRecorder(expected);
	activeRecorder = recorder;
	const restoreRoot = snapshotAttributes(document.documentElement);
	const restoreBody = snapshotAttributes(document.body);
	const restoreLocalStorage = snapshotStorage(localStorage);
	const restoreSessionStorage = snapshotStorage(sessionStorage);
	const originalFetch = globalThis.fetch;
	const originalError = console.error;
	console.error = (...args: unknown[]) => {
		recorder.record(
			'console-error',
			args
				.map((value) =>
					value instanceof Error ? value.message : String(value)
				)
				.join(' ')
		);
		originalError(...args);
	};
	const onError = (event: ErrorEvent) =>
		recorder.record('uncaught-error', event.message);
	const onRejection = (event: PromiseRejectionEvent) =>
		recorder.record(
			'unhandled-rejection',
			event.reason instanceof Error
				? event.reason.message
				: String(event.reason)
		);
	window.addEventListener('error', onError);
	window.addEventListener('unhandledrejection', onRejection);

	let sawFallback = false;
	const fallbackSelector =
		'[data-sb-needs-data], [data-error-boundary], [data-story-fallback]';
	const inspectMutations = (records: MutationRecord[]) => {
		records.forEach((record) =>
			record.addedNodes.forEach((node) => {
				if (
					node instanceof Element &&
					(node.matches(fallbackSelector) ||
						node.querySelector(fallbackSelector))
				) {
					sawFallback = true;
				}
			})
		);
	};
	const observer = new MutationObserver(inspectMutations);
	observer.observe(document.body, { childList: true, subtree: true });

	let finished = false;
	const finish = (record?: RecordEvidence) => {
		if (finished) return;
		finished = true;
		try {
			inspectMutations(observer.takeRecords());
			if (
				sawFallback ||
				document.querySelector(
					'[data-sb-needs-data], [data-error-boundary], [data-story-fallback]'
				)
			) {
				recorder.record(
					'fallback',
					'A failure fallback replaced the story'
				);
			}
			record?.({
				storyId: context.id,
				classification: context.declaredNeedsData
					? 'declared-needs-data'
					: 'story'
			});
			recorder.assertComplete();
		} finally {
			try {
				observer.disconnect();
				globalThis.fetch = originalFetch;
				console.error = originalError;
				window.removeEventListener('error', onError);
				window.removeEventListener('unhandledrejection', onRejection);
				activeRecorder = undefined;
				restoreRoot();
				restoreBody();
				restoreLocalStorage();
				restoreSessionStorage();
			} finally {
				releaseAnimations();
			}
		}
	};
	let completion: Promise<void> | undefined;
	let completed = false;
	const complete = (record?: RecordEvidence) => {
		if (completed) return Promise.resolve();
		completion ??= (async () => {
			const errors: unknown[] = [];
			// Owned async work remains inside the same recorder and state snapshot.
			try {
				await context.cleanup?.();
			} catch (error) {
				errors.push(error);
			}
			try {
				finish(record);
			} catch (error) {
				errors.unshift(error);
			} finally {
				completed = true;
				if (activeCompletion === complete) activeCompletion = undefined;
			}
			if (errors.length)
				throw new AggregateError(errors, errors.map(String).join('\n'));
		})();
		return completion;
	};
	activeCompletion = complete;
	return Object.assign(finish, { complete });
};

export const finishStoryVerification = (record?: RecordEvidence) =>
	activeCompletion?.(record) ?? Promise.resolve();
