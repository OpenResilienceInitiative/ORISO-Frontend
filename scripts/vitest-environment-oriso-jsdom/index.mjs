import { builtinEnvironments } from 'vitest/runtime';
import { VirtualConsole } from 'jsdom';

const builtin = builtinEnvironments.jsdom;
const NativeAggregateError = AggregateError;
const NativePromise = Promise;

export function forwardEnvironmentOptions(options) {
	// A docblock replaces project environmentOptions in pinned Vitest; do not
	// invent a deep merge or change values (including false/null/undefined).
	return Object.prototype.hasOwnProperty.call(options, 'oriso-jsdom')
		? { ...options, jsdom: options['oriso-jsdom'] }
		: options;
}

/** @type {import('vitest/runtime').Environment} */
const environment = {
	name: builtin.name,
	viteEnvironment: builtin.viteEnvironment,
	prewarmModules: builtin.prewarmModules,
	// Pilot covers public setup only. VM pools fail unsupported, never bypass capture.
	async setup(global, options) {
		const forwarded = forwardEnvironmentOptions(options);
		const { jsdom = {} } = forwarded;
		// Destructure before copying: invalid null options must still fail visibly.
		const { virtualConsole: suppliedConsole } = jsdom;
		// Match pinned jsdom 24's default forwarding. Reuse a caller's console
		// unchanged; attaching after builtin.setup misses synchronous HTML errors.
		const virtualConsole =
			suppliedConsole === undefined
				? new VirtualConsole().sendTo(globalThis.console)
				: suppliedConsole;
		if (!(virtualConsole instanceof VirtualConsole))
			throw new TypeError(
				'virtualConsole must be an instance of VirtualConsole'
			);
		const unhandled = [];
		const listen = (error) => {
			if (
				typeof error === 'object' &&
				error !== null &&
				'type' in error &&
				error.type === 'unhandled exception'
			) {
				unhandled.push(error);
			}
		};
		let delegated;
		try {
			virtualConsole.on('jsdomError', listen);
			delegated = await builtin.setup(global, {
				...forwarded,
				jsdom: { ...jsdom, virtualConsole }
			});
			if (global.jsdom?.virtualConsole !== virtualConsole)
				throw new Error(
					'Public builtin jsdom did not retain the instrumented virtualConsole'
				);
		} catch (setupError) {
			const failures = [setupError];
			if (delegated) {
				try {
					await delegated.teardown(global);
				} catch (teardownError) {
					failures.push(teardownError);
				}
			}
			try {
				virtualConsole.removeListener('jsdomError', listen);
			} catch (cleanupError) {
				failures.push(cleanupError);
			}
			failures.push(...unhandled);
			if (failures.length === 1) throw failures[0];
			throw new NativeAggregateError(
				failures,
				'jsdom capture setup and cleanup failed'
			);
		}
		return {
			...delegated,
			async teardown(target) {
				const failures = [];
				try {
					try {
						await delegated.teardown(target);
					} catch (error) {
						failures.push(error);
					}
					// Existing measured checkpoint; no claim of all future async drainage.
					try {
						await NativePromise.resolve();
					} catch (error) {
						failures.push(error);
					}
				} finally {
					// Remove only this environment's listener, after the checkpoint.
					try {
						virtualConsole.removeListener('jsdomError', listen);
					} catch (error) {
						failures.push(error);
					}
				}
				if (unhandled.length > 0) {
					throw new NativeAggregateError(
						[...failures, ...unhandled],
						'Unhandled jsdom exceptions during native environment lifecycle'
					);
				}
				// Preserve even arbitrary falsy builtin teardown/cleanup throws.
				if (failures.length === 1) throw failures[0];
				if (failures.length > 1)
					throw new NativeAggregateError(
						failures,
						'jsdom teardown and capture cleanup failed'
					);
			}
		};
	}
};
export default environment;
