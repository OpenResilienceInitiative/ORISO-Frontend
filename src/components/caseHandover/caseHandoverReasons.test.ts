import { describe, expect, it, vi } from 'vitest';
import {
	CASE_HANDOVER_REASON_CODES,
	caseHandoverReasonLabel,
	caseHandoverReasonLabelOf,
	caseHandoverReasonOptionLabel,
	isKnownCaseHandoverReasonCode,
	neutralLegacyReasonLabel
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

	// Retired codes read as health statements; show the neutral successor the
	// backend maps them to (UserService CaseHandoverReasonCodes), never the
	// server wording.
	it.each([
		['COUNSELLOR_IS_ILL', 'UNPLANNED_ABSENCE'],
		['COUNSELLOR_ON_HOLIDAY', 'PLANNED_ABSENCE'],
		['COUNSELLOR_LEFT', 'ASSIGNMENT_ENDED'],
		['COUNSELLOR_ASKED_FOR_ADVICE', 'ADVICE_REQUESTED']
	])(
		'shows the neutral successor for the retired code %s',
		(code, successor) => {
			expect(
				caseHandoverReasonLabel(
					translate as never,
					code,
					'Beraterin ist krank'
				)
			).toBe(`t:caseHandover.reason.${successor}`);
		}
	);

	it('shows "not specified" for a retired code without successor', () => {
		expect(
			caseHandoverReasonLabel(
				translate as never,
				'OTHER_EMERGENCY',
				'Other emergency'
			)
		).toBe('t:caseHandover.reason.retired');
	});

	it('still falls back to the server label for a genuinely unknown code', () => {
		expect(
			caseHandoverReasonLabel(
				translate as never,
				'TENANT_SPECIFIC_CODE',
				'Tenant wording'
			)
		).toBe('Tenant wording');
	});

	describe('picker option label', () => {
		it('translates a known code', () => {
			expect(
				caseHandoverReasonOptionLabel(translate, {
					code: 'ADVICE_REQUESTED',
					label: 'Server wording'
				})
			).toBe('t:caseHandover.reason.ADVICE_REQUESTED');
		});

		it('shows a retired code as its neutral successor', () => {
			expect(
				caseHandoverReasonOptionLabel(translate, {
					code: 'COUNSELLOR_IS_ILL',
					label: 'Counsellor is ill'
				})
			).toBe('t:caseHandover.reason.UNPLANNED_ABSENCE');
		});

		it('falls back to the code when the server sent no label', () => {
			expect(
				caseHandoverReasonOptionLabel(translate, {
					code: 'TENANT_SPECIFIC',
					label: ''
				})
			).toBe('TENANT_SPECIFIC');
		});
	});

	// Legacy CASE_HANDOVER_GRANTED chat notices carry only the label.
	describe('legacy notice label', () => {
		it.each([
			['Counsellor is ill', 'UNPLANNED_ABSENCE'],
			['  counsellor IS ILL ', 'UNPLANNED_ABSENCE'],
			['Counsellor is on holiday', 'PLANNED_ABSENCE'],
			['Counsellor asked for advice', 'ADVICE_REQUESTED'],
			['Counsellor does not work here anymore', 'ASSIGNMENT_ENDED'],
			["Counsellor doesn't work here anymore", 'ASSIGNMENT_ENDED']
		])('replaces the retired label "%s"', (label, successor) => {
			expect(neutralLegacyReasonLabel(translate, label)).toBe(
				`t:caseHandover.reason.${successor}`
			);
		});

		it('keeps any other label', () => {
			expect(
				neutralLegacyReasonLabel(translate, 'Unplanned absence')
			).toBe('Unplanned absence');
			expect(neutralLegacyReasonLabel(translate, '')).toBe('');
		});
	});
});
