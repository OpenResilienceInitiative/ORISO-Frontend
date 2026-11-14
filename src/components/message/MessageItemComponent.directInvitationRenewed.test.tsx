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
		t: (key: string, options?: Record<string, unknown>) =>
			options?.date ? `${key}|${String(options.date)}` : key,
		i18n: { language: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

const renewed = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'DIRECT_INVITATION_RENEWED',
	linkId: 9,
	url: 'https://app.example/invite/new',
	expiresAt: '2026-11-21T14:00:00Z'
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

describe('MessageItemComponent — new Direkteinladung link (#2252)', () => {
	it.each(['asker', 'consultant'] as const)(
		'shows the %s a notice card with the new link',
		(viewer) => {
			renderNotice({
				raw: renewed,
				senderId: MOCK_CONSULTANT_MATRIX_ID,
				viewer
			});
			expect(
				screen.getAllByText('directInvitation.renewed.title').length
			).toBeGreaterThan(0);
			const link = screen.getByRole('link', {
				name: 'https://app.example/invite/new'
			});
			expect(link.getAttribute('href')).toBe(
				'https://app.example/invite/new'
			);
			// Never the raw JSON payload.
			expect(document.body.textContent).not.toContain('linkId');
			expect(document.body.textContent).not.toContain(
				'DIRECT_INVITATION_RENEWED'
			);
		}
	);
});
