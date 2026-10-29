// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	E2EEContext,
	ServerSettingsContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { MessageItemComponent } from './MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	MOCK_CONSULTANT_MATRIX_ID,
	mockActiveSession1on1,
	mockE2EEContext,
	mockE2eeParams,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockUserData
} from './MessageItemComponent.mocks';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('../profile/NewRequestDialog/NewRequestDialog', () => ({
	NewRequestDialog: () => null
}));
vi.mock('../furtherCounselling/useFurtherCounsellingPrefill', () => ({
	useFurtherCounsellingPrefill: () => ({
		prefilledPostcode: undefined,
		knownAgencyIds: []
	})
}));

const recommendation = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'FURTHER_COUNSELLING_RECOMMENDED',
	topicId: 7,
	note: 'Die Schuldnerberatung kann hier gut helfen.',
	recommendedBy: 'consultant-storybook',
	createdAt: '2026-10-28T10:00:00Z'
})}`;
const duplicateStarted = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'TOPIC_DUPLICATE_STARTED',
	topicId: 7
})}`;

const renderNotice = ({
	raw,
	senderId,
	viewer,
	consultantMatrixUserId = MOCK_CONSULTANT_MATRIX_ID
}: {
	raw: string;
	senderId: string;
	viewer: 'asker' | 'consultant';
	consultantMatrixUserId?: string;
}) =>
	render(
		<MemoryRouter>
			<TenantContext.Provider
				value={{
					tenant: { id: 1, settings: {} } as any,
					setTenant: () => {}
				}}
			>
				<ServerSettingsContext.Provider
					value={mockServerSettingsContext() as any}
				>
					<E2EEContext.Provider value={mockE2EEContext() as any}>
						<UserDataContext.Provider
							value={
								{
									userData: mockUserData(
										viewer === 'asker'
											? {
													userId: MOCK_ASKER_MATRIX_ID,
													grantedAuthorities: [
														AUTHORITIES.ASKER_DEFAULT
													]
												}
											: {}
									),
									setUserData: () => {},
									reloadUserData: async () => null as any
								} as any
							}
						>
							<ActiveSessionContext.Provider
								value={
									{
										activeSession: {
											...mockActiveSession1on1(),
											item: {
												...mockActiveSession1on1().item,
												conversationType:
													'AGENCY_COUNSELLING',
												consultantMatrixUserId
											}
										},
										reloadActiveSession: () => {},
										readActiveSession: () => {}
									} as any
								}
							>
								<MessageItemComponent
									{...mockMessageItemComponentProps({
										message: raw,
										userId: senderId,
										messageTime: '1',
										t: null
									})}
									handleDecryptionErrors={() => {}}
									handleDecryptionSuccess={() => {}}
									e2eeParams={mockE2eeParams() as any}
								/>
							</ActiveSessionContext.Provider>
						</UserDataContext.Provider>
					</E2EEContext.Provider>
				</ServerSettingsContext.Provider>
			</TenantContext.Provider>
		</MemoryRouter>
	);

afterEach(cleanup);

describe('MessageItemComponent — further counselling notices (FE#1876)', () => {
	it('shows the asker the counsellor card with its button', () => {
		renderNotice({
			raw: recommendation,
			senderId: MOCK_CONSULTANT_MATRIX_ID,
			viewer: 'asker'
		});
		expect(screen.getByText('furtherCounselling.card.title')).toBeTruthy();
		expect(
			screen.getByText('furtherCounselling.card.defaultText')
		).toBeTruthy();
		expect(
			screen.getByText('Die Schuldnerberatung kann hier gut helfen.')
		).toBeTruthy();
		expect(
			screen.getByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeTruthy();
		// Never the raw JSON payload.
		expect(document.body.textContent).not.toContain('topicId');
	});

	it('shows the counsellor the same card without the button', () => {
		renderNotice({
			raw: recommendation,
			senderId: MOCK_CONSULTANT_MATRIX_ID,
			viewer: 'consultant'
		});
		expect(
			screen.getByText('furtherCounselling.card.defaultText')
		).toBeTruthy();
		expect(
			screen.queryByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeNull();
	});

	it('draws nothing for a recommendation the advice seeker posted', () => {
		renderNotice({
			raw: recommendation,
			senderId: MOCK_ASKER_MATRIX_ID,
			viewer: 'asker'
		});
		expect(
			screen.queryByText('furtherCounselling.card.defaultText')
		).toBeNull();
		expect(document.body.textContent).not.toContain('topicId');
	});

	it('draws nothing for a recommendation another room member posted', () => {
		renderNotice({
			raw: recommendation,
			senderId: '@team-colleague:matrix.test',
			viewer: 'asker'
		});
		expect(
			screen.queryByText('furtherCounselling.card.defaultText')
		).toBeNull();
		expect(
			screen.queryByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeNull();
	});

	it('draws nothing while the counsellor id of the session is unknown', () => {
		renderNotice({
			raw: recommendation,
			senderId: MOCK_CONSULTANT_MATRIX_ID,
			viewer: 'asker',
			consultantMatrixUserId: ''
		});
		expect(
			screen.queryByText('furtherCounselling.card.defaultText')
		).toBeNull();
		expect(
			screen.queryByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeNull();
	});

	it('shows the same-topic notice as plain text', () => {
		renderNotice({
			raw: duplicateStarted,
			senderId: MOCK_ASKER_MATRIX_ID,
			viewer: 'consultant'
		});
		expect(
			screen.getByText('furtherCounselling.duplicate.startedTitle')
		).toBeTruthy();
		expect(
			screen.getByText('furtherCounselling.duplicate.started')
		).toBeTruthy();
		expect(document.body.textContent).not.toContain('newSessionId');
	});
});
