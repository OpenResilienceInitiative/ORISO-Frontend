import { describe, expect, it } from 'vitest';
import { resolveFeedbackMailIntent } from './feedbackMailIntent';

describe('actual feedback compose intent', () => {
	it('includes the owner using the dedicated feedback composer without supervisor role', () => {
		expect(
			resolveFeedbackMailIntent({
				explicitFeedbackComposer: true,
				supervisorFeedbackAction: false
			})
		).toBe(true);
	});
	it('includes the existing explicit supervisor feedback action', () => {
		expect(
			resolveFeedbackMailIntent({ supervisorFeedbackAction: true })
		).toBe(true);
	});
	it('does not infer feedback for a generic aside, normal chat or team compose', () => {
		expect(resolveFeedbackMailIntent({})).toBe(false);
		expect(
			resolveFeedbackMailIntent({
				explicitFeedbackComposer: true,
				teamDiscussion: true
			})
		).toBe(false);
	});
	it('preserves the original retry intent despite a changed composer mode', () => {
		expect(
			resolveFeedbackMailIntent({ retry: { feedbackMailIntent: true } })
		).toBe(true);
		expect(
			resolveFeedbackMailIntent({
				explicitFeedbackComposer: true,
				supervisorFeedbackAction: true,
				retry: { feedbackMailIntent: false }
			})
		).toBe(false);
	});
});
