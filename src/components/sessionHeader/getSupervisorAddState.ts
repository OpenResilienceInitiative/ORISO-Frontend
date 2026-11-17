/**
 * FE#513 — single source of truth for the 1:1 header's add-supervisor "+"
 * affordance. Product decision 2026-07-18: the control is always a real
 * button; when it cannot act it is disabled with an honest label — including
 * for askers (grey out, never hide).
 */

/**
 * `pending`: the conversation's agency has not answered yet. The "+" keeps
 * the look it will most likely have so it does not flash grey and back on
 * every conversation switch; it does nothing until the answer arrives.
 */
export type SupervisorAddMode = 'interactive' | 'disabled' | 'pending';

export interface SupervisorAddState {
	mode: SupervisorAddMode;
	labelKey: string;
}

export interface SupervisorAddInput {
	isAsker: boolean;
	isConsultant: boolean;
	isSupervisionEnabled: boolean;
	isSupervisor: boolean;
	isMobile: boolean;
	/** The agency's feature answer is in (or final). Defaults to true. */
	isSettled?: boolean;
}

export const getSupervisorAddState = ({
	isAsker,
	isConsultant,
	isSupervisionEnabled,
	isSupervisor,
	isMobile,
	isSettled = true
}: SupervisorAddInput): SupervisorAddState => {
	if (isAsker) {
		return {
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledAsker'
		};
	}

	// The phone answer is grey either way, so it needs no waiting state.
	if (isConsultant && !isSettled && !isSupervisor && !isMobile) {
		return {
			mode: 'pending',
			labelKey: 'sessionHeader.supervisor.modal.title'
		};
	}

	const couldManageSupervision =
		isConsultant && isSupervisionEnabled && !isSupervisor;

	if (!couldManageSupervision) {
		return {
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledUnavailable'
		};
	}

	if (isMobile) {
		return {
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledMobile'
		};
	}

	return {
		mode: 'interactive',
		labelKey: 'sessionHeader.supervisor.modal.title'
	};
};
