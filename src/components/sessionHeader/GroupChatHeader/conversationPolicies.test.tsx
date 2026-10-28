// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { GroupChatHeader } from './index';
import {
	ActiveSessionContext,
	SessionTypeContext,
	type ExtendedSessionInterface
} from '../../../globalState';
import { MessageContextShell } from '../../message/messageStoryShell';
import { mockActiveSessionGroup } from '../../message/MessageItemComponent.mocks';
import { canonicalAgencySettings } from '../../../test/fixtures/conversationPolicyFixtures';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({
		featureCallsEnabled: false,
		featureAudioCallsEnabled: false,
		featureAudioCallsGroupChatsEnabled: false,
		featureVideoCallsEnabled: false,
		featureVideoCallsGroupChatsEnabled: false
	})
}));
vi.mock('../../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: undefined })
}));
vi.mock('../../sessionMenu/SessionMenu', () => ({ SessionMenu: () => null }));
vi.mock('../ChatroomMainInteractionIcon', () => ({
	ChatroomMainInteractionIcon: () => null
}));
const WithPolicy = ({ children }: { children: React.ReactNode }) => {
	const context = React.useContext(ActiveSessionContext);
	return (
		<ActiveSessionContext.Provider
			value={{
				...context,
				agencyFeaturePolicy: {
					agencyId: 101,
					state: 'ready',
					settings: canonicalAgencySettings()
				}
			}}
		>
			{children}
		</ActiveSessionContext.Provider>
	);
};
afterEach(cleanup);
for (const conversationType of ['SELF_HELP', 'INTERNAL_GROUP'] satisfies Array<
	'SELF_HELP' | 'INTERNAL_GROUP'
>) {
	it(`uses the resolved agency call permission in the actual ${conversationType} header`, () => {
		const base = mockActiveSessionGroup();
		const session = {
			...base,
			item: {
				...base.item,
				conversationType,
				modality: conversationType === 'SELF_HELP' ? 'VIDEO' : 'TEXT'
			}
		} satisfies ExtendedSessionInterface;
		render(
			<MemoryRouter>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<MessageContextShell activeSession={session}>
						<WithPolicy>
							<GroupChatHeader
								bannedUsers={[]}
								isJoinGroupChatView={false}
								hasUserInitiatedStopOrLeaveRequest={{
									current: false
								}}
							/>
						</WithPolicy>
					</MessageContextShell>
				</SessionTypeContext.Provider>
			</MemoryRouter>
		);
		expect(
			document.querySelector(
				'[data-cy="session-header-video-call-buttons"]'
			)
		).not.toBeNull();
	});
}
