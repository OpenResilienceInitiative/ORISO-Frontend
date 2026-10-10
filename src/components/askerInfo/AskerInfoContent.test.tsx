// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ActiveSessionContext,
	ConsultantListContext,
	SessionTypeContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { AskerInfoContent } from './AskerInfoContent';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('./AskerInfoData', () => ({ AskerInfoData: () => null }));
vi.mock('./AskerInfoTools', () => ({ AskerInfoTools: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ addNewUsersToEncryptedRoom: vi.fn() })
}));
vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverStatus: vi.fn(async () => ({
		sessionId: 41,
		status: 'ACTIVE_OWNER',
		canViewContent: true,
		clientConsentRequired: false,
		ownershipRevision: 7
	})),
	apiGetCaseHandoverRecipients: vi.fn(async () => [
		{ consultantId: 'owner-2', displayName: 'New Owner' }
	]),
	apiGetCaseHandoverReasons: vi.fn(async () => [
		{ code: 'OTHER_EMERGENCY', label: 'Emergency' }
	]),
	apiGetCaseHandoverRequestStatus: vi.fn(),
	apiCreateCaseHandoverOffer: vi.fn()
}));

const renderContent = ({
	consultantId = 'owner-1',
	type = SESSION_LIST_TYPES.MY_SESSION,
	authorities = []
}: {
	consultantId?: string;
	type?: SESSION_LIST_TYPES;
	authorities?: string[];
} = {}) =>
	render(
		<MemoryRouter>
			<TenantContext.Provider value={{ tenant: { settings: {} } } as any}>
				<UserDataContext.Provider
					value={
						{
							userData: {
								userId: 'owner-1',
								grantedAuthorities: [
									'AUTHORIZATION_CONSULTANT_DEFAULT',
									...authorities
								]
							}
						} as any
					}
				>
					<SessionTypeContext.Provider
						value={{
							type,
							path: '/sessions/consultant/sessionView'
						}}
					>
						<ActiveSessionContext.Provider
							value={{
								activeSession: {
									isGroup: false,
									consultant: { id: consultantId },
									item: { id: 41, agencyId: 9 }
								} as any
							}}
						>
							<ConsultantListContext.Provider
								value={{
									consultantList: [
										{
											value: 'owner-1',
											label: 'Current Owner'
										},
										{ value: 'owner-2', label: 'New Owner' }
									],
									setConsultantList: vi.fn()
								}}
							>
								<AskerInfoContent />
							</ConsultantListContext.Provider>
						</ActiveSessionContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</TenantContext.Provider>
		</MemoryRouter>
	);

describe('AskerInfoContent handover entry eligibility', () => {
	afterEach(cleanup);

	it('does not expose the legacy reassign dropdown to an owner with ASSIGN authority', async () => {
		renderContent({
			authorities: ['AUTHORIZATION_ASSIGN_CONSULTANT_TO_SESSION']
		});
		expect(screen.queryByRole('combobox')).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		expect(await screen.findByRole('dialog')).toBeTruthy();
		expect(
			screen.getByRole('combobox', {
				name: 'supervisorDialog.personLabel.handover'
			})
		).toBeTruthy();
	});

	it('shows current owners the handover action without legacy ASSIGN authority', () => {
		renderContent();
		expect(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		).toBeTruthy();
		expect(screen.queryByRole('combobox')).toBeNull();
	});

	it('keeps initial enquiry assignment available without the owner handover action', () => {
		renderContent({
			consultantId: null,
			type: SESSION_LIST_TYPES.ENQUIRY,
			authorities: ['AUTHORIZATION_ASSIGN_CONSULTANT_TO_ENQUIRY']
		});
		expect(screen.getByRole('combobox')).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'caseHandover.offer.open' })
		).toBeNull();
	});

	it('preserves the existing non-owner assignment authority without exposing owner handover', () => {
		renderContent({
			consultantId: 'owner-2',
			authorities: ['AUTHORIZATION_ASSIGN_CONSULTANT_TO_SESSION']
		});
		expect(screen.getByRole('combobox')).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'caseHandover.offer.open' })
		).toBeNull();
	});

	it('does not expose assignment actions to a non-owner without ASSIGN authority', () => {
		renderContent({ consultantId: 'owner-2' });
		expect(screen.queryByRole('combobox')).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'caseHandover.offer.open' })
		).toBeNull();
	});
});
