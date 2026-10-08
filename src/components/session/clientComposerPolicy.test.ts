import { describe, expect, it } from 'vitest';
import { canRenderClientComposer } from './clientComposerPolicy';

describe('canRenderClientComposer', () => {
	it('withholds the client-room composer and uploads from supervisors', () => {
		expect(
			canRenderClientComposer({
				canWriteMessage: true,
				isSupervisor: true,
				shouldBlockAnonymousInquiryChat: false
			})
		).toBe(false);
	});

	it('keeps the composer for an authorised non-supervisor', () => {
		expect(
			canRenderClientComposer({
				canWriteMessage: true,
				isSupervisor: false,
				shouldBlockAnonymousInquiryChat: false
			})
		).toBe(true);
	});
});
