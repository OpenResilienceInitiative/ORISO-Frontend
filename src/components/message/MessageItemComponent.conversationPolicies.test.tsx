// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { ActiveSessionContext } from '../../globalState';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockMessageItemComponentProps
} from './MessageItemComponent.mocks';
import { canonicalAgencySettings } from '../../test/fixtures/conversationPolicyFixtures';
import type { AgencySettingsInterface } from '../../globalState/interfaces';
import type { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';

const runtimeTenant = vi.hoisted(() => {
	const settings: Partial<TenantDataSettingsInterface> = {};
	return { settings };
});
vi.mock('../../globalState', async (original) => {
	const react = await import('react');
	return {
		...(await original<typeof import('../../globalState')>()),
		NotificationsContext: react.createContext({
			addNotification: () => {}
		}),
		useTenant: () => ({ settings: runtimeTenant.settings })
	};
});
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
const WithPolicy = ({
	children,
	settings = canonicalAgencySettings()
}: {
	children: React.ReactNode;
	settings?: AgencySettingsInterface;
}) => {
	const context = React.useContext(ActiveSessionContext);
	return (
		<ActiveSessionContext.Provider
			value={{
				...context,
				agencyFeaturePolicy: {
					agencyId: 101,
					state: 'ready',
					settings
				}
			}}
		>
			{children}
		</ActiveSessionContext.Provider>
	);
};
beforeEach(() => {
	runtimeTenant.settings = {
		featureMediaInlineDisplayEnabled: false,
		featureMediaInlineDisplayAnonymousChatsEnabled: false,
		featureMediaInlineDisplayOneOnOneChatsEnabled: false,
		featureMediaInlineDisplayGroupChatsEnabled: false
	};
});
afterEach(cleanup);
for (const conversationType of [
	'LIVE_CHAT',
	'AGENCY_COUNSELLING',
	'SELF_HELP'
] satisfies Array<'LIVE_CHAT' | 'AGENCY_COUNSELLING' | 'SELF_HELP'>) {
	it(`renders an allowed inline image from canonical agency policy in ${conversationType}`, () => {
		const session = mockActiveSession1on1();
		render(
			<MessageContextShell
				activeSession={{
					...session,
					isGroup: conversationType === 'SELF_HELP',
					item: { ...session.item, conversationType }
				}}
			>
				<WithPolicy>
					<MessageItemComponent
						{...mockMessageItemComponentProps({
							userId: MOCK_ASKER_MATRIX_ID,
							isMyMessage: true,
							attachments: [
								{
									title: 'photo.png',
									downloadUrl:
										'https://fixture.invalid/photo.png',
									type: 'image',
									mediaType: 'image/png'
								}
							],
							file: { name: 'photo.png', type: 'image/png' }
						})}
					/>
				</WithPolicy>
			</MessageContextShell>
		);
		expect(screen.getByRole('img', { name: 'photo.png' })).toBeTruthy();
	});
}

for (const mode of ['ENFORCED', 'SUGGESTED'] satisfies Array<
	'ENFORCED' | 'SUGGESTED'
>) {
	it(`keeps existing images as file cards for a canonical ${mode} inline-off answer`, () => {
		runtimeTenant.settings = {};
		const session = mockActiveSession1on1();
		render(
			<MessageContextShell activeSession={session}>
				<WithPolicy
					settings={{
						...canonicalAgencySettings(
							{ featureMediaInlineDisplayEnabled: false },
							mode
						),
						featureMediaInlineDisplayEnabled: true
					}}
				>
					<MessageItemComponent
						{...mockMessageItemComponentProps({
							userId: MOCK_ASKER_MATRIX_ID,
							isMyMessage: true,
							attachments: [
								{
									title: 'photo.png',
									downloadUrl:
										'https://fixture.invalid/photo.png',
									type: 'image',
									mediaType: 'image/png'
								}
							],
							file: { name: 'photo.png', type: 'image/png' }
						})}
					/>
				</WithPolicy>
			</MessageContextShell>
		);
		expect(screen.queryByRole('img', { name: 'photo.png' })).toBeNull();
		expect(screen.getByText('photo.png')).toBeTruthy();
	});
}
