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
			options?.oldName
				? `${key}|${options.oldName}|${options.newName}`
				: key,
		i18n: { language: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

const renamed = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'CONSULTANT_RENAMED',
	oldName: 'Frau Alt.',
	newName: 'Frau Neu.'
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

describe('MessageItemComponent — counsellor renamed (OBP 2.1 #119)', () => {
	it.each(['asker', 'consultant'] as const)(
		'shows the %s a system card naming the old and the new name',
		(viewer) => {
			renderNotice({
				raw: renamed,
				senderId: MOCK_CONSULTANT_MATRIX_ID,
				viewer
			});
			expect(
				screen.getAllByText('message.consultantRenamedTitle').length
			).toBeGreaterThan(0);
			expect(
				screen.getByText(
					'message.consultantRenamedDescription|Frau Alt.|Frau Neu.'
				)
			).toBeTruthy();
			// Never the raw JSON payload.
			expect(document.body.textContent).not.toContain('oldName');
			expect(document.body.textContent).not.toContain(
				'CONSULTANT_RENAMED'
			);
		}
	);

	it.each([
		['a blank new name', { newName: '   ' }],
		['no old name', { oldName: undefined }],
		['the same name after trimming', { newName: ' Frau Alt. ' }]
	])('draws nothing for a rename event with %s', (_label, extra) => {
		renderNotice({
			raw: `[SYSTEM_NOTIFICATION]${JSON.stringify({
				type: 'CONSULTANT_RENAMED',
				oldName: 'Frau Alt.',
				newName: 'Frau Neu.',
				...extra
			})}`,
			senderId: MOCK_CONSULTANT_MATRIX_ID,
			viewer: 'asker'
		});
		// Neither the raw JSON payload nor the generic system card.
		expect(document.body.textContent).not.toContain('CONSULTANT_RENAMED');
		expect(document.body.textContent).not.toContain('oldName');
		expect(
			screen.queryByText('message.systemNotificationTitle')
		).toBeNull();
		expect(document.querySelector('.messageItem')).toBeNull();
	});
});
