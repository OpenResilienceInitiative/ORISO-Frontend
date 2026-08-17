import { describe, expect, it } from 'vitest';
import { getVisibleCaseHandoverInternalDetails } from './caseHandoverPrivacy';

describe('getVisibleCaseHandoverInternalDetails', () => {
	it('hides legacy internal fields from advice seekers', () => {
		expect(
			getVisibleCaseHandoverInternalDetails(false, {
				reasonLabel: 'Counsellor is ill',
				explanation: 'Sensitive internal staffing detail'
			})
		).toEqual({});
	});

	it('keeps legacy internal fields for authorized staff', () => {
		expect(
			getVisibleCaseHandoverInternalDetails(true, {
				reasonLabel: 'Counsellor is ill',
				explanation: 'Sensitive internal staffing detail'
			})
		).toEqual({
			reasonLabel: 'Counsellor is ill',
			explanation: 'Sensitive internal staffing detail'
		});
	});

	it('normalizes empty legacy fields for staff', () => {
		expect(
			getVisibleCaseHandoverInternalDetails(true, {
				reasonLabel: '',
				explanation: ''
			})
		).toEqual({});
	});
});
