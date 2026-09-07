import { describe, expect, it, vi } from 'vitest';
import {
	CASE_HANDOVER_REASON_CODES,
	caseHandoverReasonLabel,
	caseHandoverReasonLabelOf,
	isKnownCaseHandoverReasonCode
} from './caseHandoverReasons';

/** Stand-in for i18next's `t`: echoes the key it was asked for. */
const translate = vi.fn((key: string) => `t:${key}`) as any;

describe('caseHandoverReasons', () => {
	it('offers exactly the four neutral codes', () => {
		expect([...CASE_HANDOVER_REASON_CODES]).toEqual([
			'PLANNED_ABSENCE',
			'UNPLANNED_ABSENCE',
			'ASSIGNMENT_ENDED',
			'ADVICE_REQUESTED'
		]);
	});

	it.each([...CASE_HANDOVER_REASON_CODES])(
		'translates %s instead of showing the server label',
		(code) => {
			expect(
				caseHandoverReasonLabel(translate, code, 'Server label')
			).toBe(`t:caseHandover.reason.${code}`);
		}
	);

	it('falls back to the server label for a code it does not know', () => {
		// Not an English hardcode: whatever the tenant's server called it.
		expect(
			caseHandoverReasonLabel(translate, 'TENANT_SPECIFIC', 'Sonderfall')
		).toBe('Sonderfall');
	});

	it('falls back to the raw code when the server sent no label', () => {
		expect(caseHandoverReasonLabel(translate, 'TENANT_SPECIFIC')).toBe(
			'TENANT_SPECIFIC'
		);
	});

	it('returns an empty string when there is no code at all', () => {
		expect(caseHandoverReasonLabel(translate, undefined)).toBe('');
	});

	it('rejects the retired health-referencing codes', () => {
		expect(isKnownCaseHandoverReasonCode('COUNSELLOR_IS_ILL')).toBe(false);
		expect(isKnownCaseHandoverReasonCode('COUNSELLOR_ON_HOLIDAY')).toBe(
			false
		);
		expect(isKnownCaseHandoverReasonCode('OTHER_EMERGENCY')).toBe(false);
		expect(isKnownCaseHandoverReasonCode('COUNSELLOR_LEFT')).toBe(false);
		expect(
			isKnownCaseHandoverReasonCode('COUNSELLOR_ASKED_FOR_ADVICE')
		).toBe(false);
	});

	it('reads code and label off a reason object', () => {
		expect(
			caseHandoverReasonLabelOf(translate, {
				code: 'PLANNED_ABSENCE',
				label: 'Counsellor is on holiday'
			})
		).toBe('t:caseHandover.reason.PLANNED_ABSENCE');
	});
});
