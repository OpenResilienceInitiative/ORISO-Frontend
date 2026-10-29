// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	getHandoverProgress,
	HANDOVER_MILESTONES,
	HANDOVER_PROGRESS_KEY,
	markHandoverMilestone,
	reloadHandoverProgressForTests,
	resetHandoverProgress
} from './handoverProgress';

describe('handoverProgress', () => {
	beforeEach(() => {
		resetHandoverProgress();
		sessionStorage.clear();
		reloadHandoverProgressForTests();
	});

	it('starts at zero and reaches 100 only when every milestone is done', () => {
		expect(getHandoverProgress()).toBe(0);
		HANDOVER_MILESTONES.slice(0, -1).forEach(markHandoverMilestone);
		expect(getHandoverProgress()).toBeLessThan(100);
		markHandoverMilestone('screens');
		expect(getHandoverProgress()).toBe(100);
	});

	it('counts a milestone once', () => {
		markHandoverMilestone('account');
		const once = getHandoverProgress();
		markHandoverMilestone('account');
		expect(getHandoverProgress()).toBe(once);
	});

	it('carries the finished milestones across the document load', () => {
		markHandoverMilestone('account');
		markHandoverMilestone('signedIn');
		markHandoverMilestone('sessions');
		const before = getHandoverProgress();

		reloadHandoverProgressForTests();

		expect(getHandoverProgress()).toBe(before);
	});

	it('ignores storage it did not write', () => {
		sessionStorage.setItem(
			HANDOVER_PROGRESS_KEY,
			JSON.stringify(['account', 'nonsense', 42])
		);
		reloadHandoverProgressForTests();
		expect(getHandoverProgress()).toBe(
			Math.round(100 / HANDOVER_MILESTONES.length)
		);
	});

	it('forgets everything on reset', () => {
		markHandoverMilestone('account');
		resetHandoverProgress();
		expect(getHandoverProgress()).toBe(0);
		expect(sessionStorage.getItem(HANDOVER_PROGRESS_KEY)).toBeNull();
	});
});
