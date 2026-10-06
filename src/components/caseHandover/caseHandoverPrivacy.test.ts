import { describe, expect, it } from 'vitest';
import { AUTHORITIES } from '../../globalState/helpers/stateHelpers';
import { getVisibleCaseHandoverInternalDetailsForViewer } from './caseHandoverPrivacy';

describe('getVisibleCaseHandoverInternalDetailsForViewer', () => {
	it('hides legacy internal fields from advice seekers', () => {
		expect(
			getVisibleCaseHandoverInternalDetailsForViewer(
				[AUTHORITIES.ASKER_DEFAULT],
				{
					reasonLabel: 'Counsellor is ill',
					explanation: 'Sensitive internal staffing detail'
				}
			)
		).toEqual({});
	});

	it('keeps legacy internal fields for authorized staff', () => {
		expect(
			getVisibleCaseHandoverInternalDetailsForViewer(
				[AUTHORITIES.CONSULTANT_DEFAULT],
				{
					reasonLabel: 'Counsellor is ill',
					explanation: 'Sensitive internal staffing detail'
				}
			)
		).toEqual({
			reasonLabel: 'Counsellor is ill',
			explanation: 'Sensitive internal staffing detail'
		});
	});

	it('fails closed when the viewer has no granted authorities', () => {
		expect(
			getVisibleCaseHandoverInternalDetailsForViewer(undefined, {
				reasonLabel: 'Counsellor is ill',
				explanation: 'Sensitive internal staffing detail'
			})
		).toEqual({});
	});

	it('normalizes empty legacy fields for staff', () => {
		expect(
			getVisibleCaseHandoverInternalDetailsForViewer(
				[AUTHORITIES.CONSULTANT_DEFAULT],
				{
					reasonLabel: '',
					explanation: ''
				}
			)
		).toEqual({});
	});
});
