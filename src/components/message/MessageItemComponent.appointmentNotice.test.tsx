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
import { buildAppointmentNoticePayload } from './appointmentNotice';
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
			options?.name ? `${key}|${String(options.name)}` : key,
		i18n: { language: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

const renderNotice = ({
	raw,
	senderId,
	viewer,
	isMyMessage = false,
	consultantMatrixUserId = MOCK_CONSULTANT_MATRIX_ID
}: {
	raw: string;
	senderId: string;
	viewer: 'asker' | 'consultant';
	isMyMessage?: boolean;
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
										isMyMessage,
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

const structured = (kind: 'created' | 'moved' | 'cancelled') =>
	`[SYSTEM_NOTIFICATION]${buildAppointmentNoticePayload({
		kind,
		start: new Date(2026, 10, 18, 10, 0),
		end: new Date(2026, 10, 18, 11, 0),
		...(kind === 'moved' && {
			previousStart: new Date(2026, 10, 18, 13, 0),
			previousEnd: new Date(2026, 10, 18, 14, 0)
		}),
		description: 'Termin …: Mi 18. Nov 10:00–11:00'
	})}`;

const card = (kind: string) =>
	document.querySelector(`[data-cy="appointment-notice-${kind}"]`);

afterEach(cleanup);

describe('MessageItemComponent — appointment notices (FE#1960)', () => {
	it.each(['created', 'moved', 'cancelled'] as const)(
		'draws a %s notice as its card for the advice seeker',
		(kind) => {
			renderNotice({
				raw: structured(kind),
				senderId: MOCK_CONSULTANT_MATRIX_ID,
				viewer: 'asker'
			});
			expect(card(kind)).not.toBeNull();
			// Never the raw JSON payload.
			expect(document.body.textContent).not.toContain(
				'APPOINTMENT_NOTICE'
			);
		}
	);

	it('draws the counsellor’s own notice as the card', () => {
		renderNotice({
			raw: structured('cancelled'),
			senderId: MOCK_CONSULTANT_MATRIX_ID,
			viewer: 'consultant',
			isMyMessage: true
		});
		expect(card('cancelled')).not.toBeNull();
	});

	it('recognises a notice sent as a plain sentence before', () => {
		renderNotice({
			raw: 'Termin abgesagt: Mi 18. Nov 10:00–11:00',
			senderId: MOCK_CONSULTANT_MATRIX_ID,
			viewer: 'asker'
		});
		expect(card('cancelled')).not.toBeNull();
		expect(screen.getByTestId('appointment-notice-slot').textContent).toBe(
			'Mi 18. Nov 10:00–11:00'
		);
	});

	it('leaves the same words from the advice seeker an ordinary message', () => {
		renderNotice({
			raw: 'Termin abgesagt: Mi 18. Nov 10:00–11:00',
			senderId: MOCK_ASKER_MATRIX_ID,
			viewer: 'consultant'
		});
		expect(card('cancelled')).toBeNull();
		expect(document.body.textContent).toContain('Termin abgesagt');
	});

	it('draws no card for a payload from anyone but the counsellor', () => {
		renderNotice({
			raw: structured('created'),
			senderId: MOCK_ASKER_MATRIX_ID,
			viewer: 'consultant'
		});
		expect(card('created')).toBeNull();
	});
});
