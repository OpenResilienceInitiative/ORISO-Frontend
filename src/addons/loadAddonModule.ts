import { AddonModule } from './addonTypes';

const modules = new Map<string, Promise<AddonModule>>();

const importModule = (url: string): Promise<unknown> =>
	import(/* webpackIgnore: true */ /* @vite-ignore */ url);

export const isAddonModule = (candidate: unknown): candidate is AddonModule =>
	typeof candidate === 'object' &&
	candidate !== null &&
	typeof (candidate as AddonModule).mount === 'function' &&
	typeof (candidate as AddonModule).unmount === 'function';

/** Loads an add-on bundle once per URL. A failed load is forgotten so it can be retried. */
export const loadAddonModule = (
	url: string,
	load: (url: string) => Promise<unknown> = importModule
): Promise<AddonModule> => {
	const cached = modules.get(url);
	if (cached) {
		return cached;
	}
	const pending = load(url).then((module) => {
		const candidate = (module as { default?: unknown })?.default ?? module;
		if (!isAddonModule(candidate)) {
			throw new Error(
				`Add-on bundle ${url} does not export mount and unmount`
			);
		}
		return candidate;
	});
	pending.catch(() => modules.delete(url));
	modules.set(url, pending);
	return pending;
};

export const resetAddonModulesForTests = () => modules.clear();
