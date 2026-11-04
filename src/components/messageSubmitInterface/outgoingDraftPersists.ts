/**
 * A composer that unmounts (e.g. the responsive remount when a Drafts iframe
 * is widened) starts an asynchronous save, including encryption. Its
 * replacement loads the same draft immediately and could read the older server
 * copy. Saves started on leave are tracked per scope so the next load waits
 * for them first.
 */
const outgoingPersists = new Map<string, Set<Promise<unknown>>>();

export const trackOutgoingDraftPersist = (
	scopeKey: string,
	persist: Promise<unknown>
): void => {
	const set = outgoingPersists.get(scopeKey) ?? new Set<Promise<unknown>>();
	outgoingPersists.set(scopeKey, set);
	set.add(persist);
	const done = () => {
		set.delete(persist);
		if (set.size === 0 && outgoingPersists.get(scopeKey) === set) {
			outgoingPersists.delete(scopeKey);
		}
	};
	persist.then(done, done);
};

const pendingFor = (scopeKeys: string[]) =>
	scopeKeys.flatMap((key) => [...(outgoingPersists.get(key) ?? [])]);

/** Synchronous, so a load with nothing to wait for adds no extra tick. */
export const hasOutgoingDraftPersists = (scopeKeys: string[]): boolean =>
	pendingFor(scopeKeys).length > 0;

/** A hung save must never keep the replacement composer from loading. */
const MAX_WAIT_MS = 3000;

export const waitForOutgoingDraftPersists = async (
	scopeKeys: string[]
): Promise<void> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, MAX_WAIT_MS);
	});
	try {
		await Promise.race([
			Promise.allSettled(pendingFor(scopeKeys)),
			timeout
		]);
	} finally {
		clearTimeout(timer);
	}
};

/** Test isolation: the registry is module state. */
export const resetOutgoingDraftPersists = (): void => {
	outgoingPersists.clear();
};
