// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import { endpoints } from '../../resources/scripts/endpoints';
import { AskerInfoAssign } from './AskerInfoAssign';

// Replace only the external animation library and HTTP server; the form,
// dialog, translations, API wrappers and fetchData stay real.
vi.mock('lottie-react', () => ({ default: () => null }));

const translations = createInstance().use(initReactI18next);
const selectedReason = {
	code: 'UNPLANNED_ABSENCE',
	label: 'Unplanned absence',
	clientConsentRequired: false,
	accessAllowed: true
};
const activeSession = {
	isGroup: false,
	consultant: { id: 'policy-owner' },
	item: { id: 741, agencyId: 9 }
} as React.ContextType<typeof ActiveSessionContext>['activeSession'];
const caller = {
	userData: { userId: 'policy-owner', grantedAuthorities: [] }
} as React.ContextType<typeof UserDataContext>;

const renderForm = () =>
	render(
		<I18nextProvider i18n={translations}>
			<UserDataContext.Provider value={caller}>
				<ActiveSessionContext.Provider value={{ activeSession }}>
					<AskerInfoAssign
						showLegacyAssignment={false}
						handoverEnabled
					/>
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</I18nextProvider>
	);

const choose = async (label: string, option: string) => {
	fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
	fireEvent.click(await screen.findByRole('option', { name: option }));
};

beforeEach(async () => {
	sessionStorage.clear();
	await translations.init({
		lng: 'en',
		fallbackLng: 'en',
		resources: { en: { translation: {} } }
	});
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('owner handover form with the real API and dialog', () => {
	it('can send a refreshed offer only after choosing another allowed reason', async () => {
		let reasonLoads = 0;
		let offerAttempts = 0;
		vi.stubGlobal('fetch', async (request: Request) => {
			if (request.url === endpoints.caseHandoverReasons) {
				reasonLoads += 1;
				return Response.json([
					{ ...selectedReason, accessAllowed: reasonLoads === 1 },
					{
						code: 'ADVICE_REQUESTED',
						label: 'Advice',
						clientConsentRequired: false
					},
					{
						code: 'COUNSELLOR_ASKED_FOR_ADVICE',
						label: 'Legacy advice',
						clientConsentRequired: false
					},
					{
						code: 'ASSIGNMENT_ENDED',
						label: 'Disabled takeover',
						clientConsentRequired: false,
						accessAllowed: false
					},
					{
						code: 'PLANNED_ABSENCE',
						label: 'Planned absence',
						clientConsentRequired: false
					}
				]);
			}
			if (request.url.endsWith('/case-handover/recipients')) {
				return Response.json([
					{
						consultantId: 'policy-recipient',
						displayName: 'New Owner'
					}
				]);
			}
			if (request.url.endsWith('/case-handover/offers')) {
				offerAttempts += 1;
				return offerAttempts === 1
					? new Response(null, { status: 409 })
					: Response.json(
							{
								requestId: 5741,
								sessionId: 741,
								status: 'PENDING_RECIPIENT_ACCEPTANCE',
								canViewContent: true,
								clientConsentRequired: false,
								ownershipRevision: 8
							},
							{ status: 201 }
						);
			}
			if (request.url.endsWith('/case-handover')) {
				return Response.json({
					sessionId: 741,
					status: 'ACTIVE_OWNER',
					canViewContent: true,
					clientConsentRequired: false,
					ownershipRevision: reasonLoads === 0 ? 7 : 8
				});
			}
			throw new Error(`Unexpected test HTTP request: ${request.url}`);
		});
		renderForm();
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByRole('dialog');
		await choose('supervisorDialog.personLabel.handover', 'New Owner');
		fireEvent.mouseDown(
			screen.getByRole('combobox', {
				name: 'supervisorDialog.reasonLabel.handover'
			})
		);
		expect(
			screen.getAllByRole('option').map((option) => option.textContent)
		).toEqual([
			'supervisorDialog.reasonEmptyOption',
			'Unplanned absence',
			'Planned absence'
		]);
		fireEvent.click(
			screen.getByRole('option', { name: 'Unplanned absence' })
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'supervisorDialog.confirm.handover'
			})
		);

		await screen.findByText('caseHandover.offer.conflict');
		const dialog = screen.getByRole('dialog');
		expect(
			within(dialog)
				.getByRole('button', {
					name: 'supervisorDialog.confirm.handover'
				})
				.hasAttribute('disabled')
		).toBe(true);
		await choose(
			'supervisorDialog.reasonLabel.handover',
			'Planned absence'
		);
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'supervisorDialog.confirm.handover'
			})
		);
		expect(await screen.findByRole('status')).toHaveProperty(
			'textContent',
			'caseHandover.offer.status.PENDING_RECIPIENT_ACCEPTANCE'
		);
	});
});
