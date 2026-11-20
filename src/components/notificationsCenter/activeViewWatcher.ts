export const installActiveViewWatcher = (calls: string[]) => {
	calls.length = 0;
	const original = globalThis.fetch;
	const watched: typeof fetch = (input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url.includes('active-view')) calls.push(url);
		return original(input, init);
	};
	globalThis.fetch = watched;
	return () => {
		if (globalThis.fetch === watched) globalThis.fetch = original;
	};
};
