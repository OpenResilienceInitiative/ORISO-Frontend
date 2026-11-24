import { describe, expect, it } from 'vite-plus/test';
import {
	canRenderClientComposer,
	shouldHideHeaderBackOnPhone
} from './clientComposerPolicy';

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

describe('shouldHideHeaderBackOnPhone (D7)', () => {
	it('drops the header arrow on the phone when the composer carries it', () => {
		expect(
			shouldHideHeaderBackOnPhone({
				isPhoneLayout: true,
				mainComposerShown: true
			})
		).toBe(true);
	});

	it('keeps the header arrow on the phone without a composer (enquiry, read-only)', () => {
		expect(
			shouldHideHeaderBackOnPhone({
				isPhoneLayout: true,
				mainComposerShown: false
			})
		).toBe(false);
	});

	it('leaves the desktop header alone', () => {
		expect(
			shouldHideHeaderBackOnPhone({
				isPhoneLayout: false,
				mainComposerShown: true
			})
		).toBe(false);
	});
});
