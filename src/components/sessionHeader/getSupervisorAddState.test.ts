/**
 * FE#513 — the "+" in the 1:1 header is the add-supervisor entry point.
 * Visibility used to be broader than clickability, leaving a dead decorative
 * element for askers/mobile/supervisors. Decision (2026-07-18): the control is
 * always rendered as a real button; when it cannot act it is DISABLED with an
 * honest label — including for askers (explicit product decision: grey out,
 * never hide).
 */
import { describe, expect, it } from 'vitest';
import { getSupervisorAddState } from './getSupervisorAddState';

const consultantDefaults = {
	isAsker: false,
	isConsultant: true,
	isSupervisionEnabled: true,
	isSupervisor: false,
	isMobile: false
};

describe('getSupervisorAddState', () => {
	it('is interactive for a desktop consultant with supervision enabled', () => {
		expect(getSupervisorAddState(consultantDefaults)).toEqual({
			mode: 'interactive',
			labelKey: 'sessionHeader.supervisor.modal.title'
		});
	});

	it('is disabled with the asker label for askers (grey out, never hide)', () => {
		expect(
			getSupervisorAddState({
				...consultantDefaults,
				isAsker: true,
				isConsultant: false
			})
		).toEqual({
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledAsker'
		});
	});

	it('is disabled with the mobile label for a consultant below the L breakpoint', () => {
		expect(
			getSupervisorAddState({ ...consultantDefaults, isMobile: true })
		).toEqual({
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledMobile'
		});
	});

	it('is disabled when supervision is not enabled for the chat', () => {
		expect(
			getSupervisorAddState({
				...consultantDefaults,
				isSupervisionEnabled: false
			})
		).toEqual({
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledUnavailable'
		});
	});

	it('is disabled for a read-only supervisor observer', () => {
		expect(
			getSupervisorAddState({ ...consultantDefaults, isSupervisor: true })
		).toEqual({
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledUnavailable'
		});
	});

	it('falls back to disabled/unavailable for roles that are neither asker nor consultant', () => {
		expect(
			getSupervisorAddState({
				...consultantDefaults,
				isConsultant: false
			})
		).toEqual({
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledUnavailable'
		});
	});

	it('prefers the mobile reason over generic unavailability only when supervision could otherwise act', () => {
		expect(
			getSupervisorAddState({
				...consultantDefaults,
				isMobile: true,
				isSupervisionEnabled: false
			})
		).toEqual({
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledUnavailable'
		});
	});
});
