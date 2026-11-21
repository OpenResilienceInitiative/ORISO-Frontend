import { describe, expect, it } from 'vitest';

import { canBlurPassages } from './passageBlurPermission';

const me = { userId: 'u-me' };

describe('canBlurPassages', () => {
	it('lets the assigned counsellor of a one-to-one chat blur', () => {
		expect(
			canBlurPassages({
				activeSession: { consultant: { id: 'u-me' } },
				userData: me,
				isConsultant: true,
				isSupervisorView: false
			})
		).toBe(true);
	});

	it('does not let another counsellor or the advice seeker blur a one-to-one chat', () => {
		expect(
			canBlurPassages({
				activeSession: { consultant: { id: 'u-other' } },
				userData: me,
				isConsultant: true,
				isSupervisorView: false
			})
		).toBe(false);
		expect(
			canBlurPassages({
				activeSession: { consultant: { id: 'u-me' } },
				userData: me,
				isConsultant: false,
				isSupervisorView: false
			})
		).toBe(false);
	});

	it('lets the owner and named moderators of a group blur, nobody else', () => {
		const group = (consultantId: string, moderators: string[] = []) => ({
			isGroup: true,
			consultant: { id: consultantId },
			item: { moderators }
		});
		const base = { userData: me, isSupervisorView: false };
		expect(
			canBlurPassages({
				...base,
				activeSession: group('u-me'),
				isConsultant: true
			})
		).toBe(true);
		expect(
			canBlurPassages({
				...base,
				activeSession: group('u-owner', ['u-me']),
				isConsultant: false
			})
		).toBe(true);
		expect(
			canBlurPassages({
				...base,
				activeSession: group('u-owner', ['u-else']),
				isConsultant: true
			})
		).toBe(false);
	});

	it('never lets supervisors or a read-only view blur', () => {
		const session = { consultant: { id: 'u-me' } };
		expect(
			canBlurPassages({
				activeSession: session,
				userData: me,
				isConsultant: true,
				isSupervisorView: true
			})
		).toBe(false);
		expect(
			canBlurPassages({
				activeSession: session,
				userData: me,
				isConsultant: true,
				isSupervisorView: false,
				isReadOnly: true
			})
		).toBe(false);
	});
});
