import { describe, expect, it } from 'vitest';
import {
	consentBindingKey,
	ConsentResolution,
	isResolutionForSelection
} from './consentAcceptance';

const resolvedFor = (
	agencyId?: number,
	topicId?: number
): ConsentResolution => ({
	status: 'resolved',
	consentText: null,
	agencyId,
	topicId
});

/**
 * CodeRabbit Major on PR #1110: a resolution is written in an effect, which
 * runs after the commit that changed the selection. For that gap both the
 * label and `AccountData` would still hold the previous Beratungsstelle's
 * answer — long enough for a paint, and therefore long enough for a click.
 * Acting on it would show the previous sentence with an enabled checkbox and
 * record a binding pairing the *new* agency with the *previous* wording.
 *
 * Tested here rather than through the components on purpose: React Testing
 * Library flushes effects inside `act`, so the stale window does not exist in
 * jsdom and a component-level test of it passes whether or not the guard is
 * there. A component test that cannot fail is worse than none.
 */
describe('isResolutionForSelection', () => {
	it('accepts a resolution produced by the selection on screen', () => {
		expect(isResolutionForSelection(resolvedFor(42, 7), 42, 7)).toBe(true);
	});

	it('rejects one produced by a different Beratungsstelle', () => {
		expect(isResolutionForSelection(resolvedFor(42, 7), 99, 7)).toBe(false);
	});

	it('rejects one produced by a different topic', () => {
		expect(isResolutionForSelection(resolvedFor(42, 7), 42, 8)).toBe(false);
	});

	it('rejects a pending resolution', () => {
		expect(isResolutionForSelection({ status: 'pending' }, 42, 7)).toBe(
			false
		);
	});

	it('accepts the unconfigured case, where there is no selection either', () => {
		expect(
			isResolutionForSelection(
				resolvedFor(undefined, undefined),
				undefined,
				undefined
			)
		).toBe(true);
	});

	it('rejects a resolution that carries no selection against a real one', () => {
		// A resolution from before the selection was known must not be read as
		// an answer for a selection made since.
		expect(
			isResolutionForSelection(resolvedFor(undefined, undefined), 42, 7)
		).toBe(false);
	});
});

describe('consentBindingKey', () => {
	it('separates Beratungsstellen, topics and versions', () => {
		const a = consentBindingKey(42, 7, 1);
		expect(consentBindingKey(99, 7, 1)).not.toBe(a);
		expect(consentBindingKey(42, 8, 1)).not.toBe(a);
		expect(consentBindingKey(42, 7, 2)).not.toBe(a);
		expect(consentBindingKey(42, 7, 1)).toBe(a);
	});

	it('treats a missing version as its own identity, not as a wildcard', () => {
		expect(consentBindingKey(42, 7, null)).not.toBe(
			consentBindingKey(42, 7, 1)
		);
		expect(consentBindingKey(42, 7, null)).toBe(
			consentBindingKey(42, 7, undefined)
		);
	});
});
