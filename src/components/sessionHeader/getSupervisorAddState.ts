/**
 * FE#513 — single source of truth for the 1:1 header's add-supervisor "+"
 * affordance. Product decision 2026-07-18: the control is always a real
 * button; when it cannot act it is disabled with an honest label — including
 * for askers (grey out, never hide).
 */

export type SupervisorAddMode = 'interactive' | 'disabled';

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
}

export const getSupervisorAddState = ({
	isAsker,
	isConsultant,
	isSupervisionEnabled,
	isSupervisor,
	isMobile
}: SupervisorAddInput): SupervisorAddState => {
	if (isAsker) {
		return {
			mode: 'disabled',
			labelKey: 'sessionHeader.supervisor.add.disabledAsker'
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
