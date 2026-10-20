import { describe, expect, it } from 'vitest';
import { getTourHostHooks, registerTourHostHooks } from './tourHostHooks';

describe('tour host hooks registry', () => {
	it('has no hooks for a tour nobody registered', () => {
		expect(getTourHostHooks('never-registered')).toBeUndefined();
	});

	it('returns the registered hooks by tour id', () => {
		const hooks = { setup: () => {}, teardown: () => {} };
		const unregister = registerTourHostHooks('hooked-tour', hooks);

		expect(getTourHostHooks('hooked-tour')).toBe(hooks);
		expect(getTourHostHooks('other-tour')).toBeUndefined();

		unregister();
	});

	it('forgets the hooks once unregistered', () => {
		const unregister = registerTourHostHooks('gone-tour', {});

		unregister();

		expect(getTourHostHooks('gone-tour')).toBeUndefined();
	});

	it('lets a newer registration win and keeps it when the older one unregisters late', () => {
		const first = { setup: () => {} };
		const second = { setup: () => {} };
		const unregisterFirst = registerTourHostHooks('swapped-tour', first);
		const unregisterSecond = registerTourHostHooks('swapped-tour', second);

		unregisterFirst();

		expect(getTourHostHooks('swapped-tour')).toBe(second);

		unregisterSecond();
		expect(getTourHostHooks('swapped-tour')).toBeUndefined();
	});
});
