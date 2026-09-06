// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
	useNavigate: () => navigate
}));

const TRANSLATIONS: Record<string, string> = {
	'session.u25.assignment.placeholder': 'Zuweisung',
	'session.assignSelf.overlay.button.cancel': 'Abbrechen',
	'session.assignSelf.overlay.button.assign': 'Zuweisen',
	'session.assignOther.overlay.headline.1': 'Zuweisen?',
	'session.assignOther.overlay.subtitle.noTeam': 'Neu: {{newConsultant}}'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			const value = TRANSLATIONS[key] ?? key;
			return typeof options?.newConsultant === 'string'
				? value.replace('{{newConsultant}}', options.newConsultant)
				: value;
		},
		i18n: { language: 'de' }
	})
}));

vi.mock('../../api', () => ({
	apiGetAgencyConsultantList: vi.fn(() => Promise.resolve([])),
	apiSessionAssign: vi.fn(() => Promise.resolve()),
	apiDeleteUserFromRoom: vi.fn(() => Promise.resolve()),
	FETCH_ERRORS: { CONFLICT: 'CONFLICT' }
}));

vi.mock('../../api/apiSendAliasMessage', () => ({
	apiSendAliasMessage: vi.fn(() => Promise.resolve()),
	ALIAS_MESSAGE_TYPES: { REASSIGN_CONSULTANT: 'REASSIGN_CONSULTANT' },
	ReassignStatus: { REQUESTED: 'REQUESTED' }
}));

vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ addNewUsersToEncryptedRoom: vi.fn() })
}));

// The overlay reaches AnimatedIllustration, whose player wants a real canvas.
// Same seam AnimatedIllustration.test.tsx uses.
vi.mock('lottie-react', () => ({
	default: () => <div data-lottie="true" />,
	useLottie: () => ({ View: null })
}));

// jsdom gives every node zero layout, so focus-trap sees no tabbable element
// and throws on activate. The trap is not what this file is testing.
vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import { RequestSessionAssign } from './RequestSessionAssign';
import { AskerInfoActionContext } from '../askerInfo/askerInfoActionContext';
import {
	ActiveSessionContext,
	ConsultantListContext,
	E2EEContext,
	ModalProvider,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';

const CURRENT = { value: 'consultant-1', label: 'Erika Beispiel' };
const OTHER = { value: 'consultant-2', label: 'Max Mustermann' };

const consultantList = [
	{ ...CURRENT, consultantDisplayName: CURRENT.label },
	{ ...OTHER, consultantDisplayName: OTHER.label }
];

const activeSession = {
	item: { id: 42, agencyId: 7, matrixRoomId: '!room:oriso' },
	rid: '!room:oriso',
	user: { username: 'anonymer-nutzer' },
	consultant: { id: CURRENT.value }
};

/**
 * Renders the select the client profile shows, recording every value the
 * footer's context is handed so the assertions can look at the whole history
 * rather than only the last render.
 */
const renderAssign = () => {
	const reported: boolean[] = [];
	const setHasPendingChange = (value: boolean) => {
		reported.push(value);
	};

	// Overlay portals into #overlay and registers itself with ModalProvider.
	if (!document.getElementById('overlay')) {
		const overlayRoot = document.createElement('div');
		overlayRoot.id = 'overlay';
		document.body.appendChild(overlayRoot);
	}

	render(
		<ActiveSessionContext.Provider value={{ activeSession } as any}>
			<SessionTypeContext.Provider value={{ path: '/sessions' } as any}>
				<UserDataContext.Provider
					value={
						{
							userData: { userId: 'me' },
							reloadUserData: vi.fn()
						} as any
					}
				>
					<ConsultantListContext.Provider
						value={
							{
								consultantList,
								setConsultantList: vi.fn()
							} as any
						}
					>
						<E2EEContext.Provider
							value={{ isE2eeEnabled: false } as any}
						>
							<AskerInfoActionContext.Provider
								value={{
									hasPendingChange: false,
									setHasPendingChange
								}}
							>
								<ModalProvider>
									{/* AskerInfoAssign pins this to the
									    session's current consultant. */}
									<RequestSessionAssign
										value={CURRENT.value}
									/>
								</ModalProvider>
							</AskerInfoActionContext.Provider>
						</E2EEContext.Provider>
					</ConsultantListContext.Provider>
				</UserDataContext.Provider>
			</SessionTypeContext.Provider>
		</ActiveSessionContext.Provider>
	);

	return { reported };
};

const pick = async (label: string) => {
	fireEvent.mouseDown(screen.getByRole('combobox'));
	const option = await screen.findByRole('option', { name: label });
	fireEvent.click(option);
};

describe('RequestSessionAssign — pending-change reporting (#1192)', () => {
	beforeEach(() => {
		navigate.mockClear();
	});
	afterEach(cleanup);

	it('reports nothing pending while the session consultant is shown', () => {
		const { reported } = renderAssign();

		expect(reported.every((value) => value === false)).toBe(true);
	});

	/*
	 * The regression this file exists for.
	 *
	 * `hasPendingChange` used to be latched in `handleDatalistSelect` and
	 * nothing cleared it. Cancelling the confirmation ran the overlay's CLOSE
	 * branch, which resets the overlay and returns — so the profile footer's
	 * next button stayed primary and enabled with nothing pending, while the
	 * select had already snapped back to the original consultant because
	 * AskerInfoAssign pins `value` and OrisoSelect is fully controlled.
	 */
	it('does not leave a pending change behind when the reassign is cancelled', async () => {
		const { reported } = renderAssign();

		await pick(OTHER.label);
		expect(await screen.findByText('Zuweisen?')).toBeTruthy();

		fireEvent.click(screen.getByText('Abbrechen'));

		await waitFor(() => {
			expect(screen.queryByText('Zuweisen?')).toBeNull();
		});

		// The select shows the original consultant again...
		expect(screen.getByRole('combobox').textContent).toContain(
			CURRENT.label
		);
		// ...so the footer must not have been told anything is pending.
		expect(reported.at(-1)).toBe(false);
		expect(navigate).not.toHaveBeenCalled();
	});
});
