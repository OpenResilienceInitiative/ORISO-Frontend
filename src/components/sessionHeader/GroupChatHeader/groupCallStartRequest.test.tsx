// @vitest-environment oriso-jsdom
/* FE#2482 / FE#2483 review: the group header takes a circle's start-call
   request with the checks that show its own call buttons. */
import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { GroupChatHeader } from './index';
import {
	NotificationsContext,
	SessionTypeContext,
	type ExtendedSessionInterface
} from '../../../globalState';
import { MessageContextShell } from '../../message/messageStoryShell';
import {
	mockActiveSessionGroup,
	mockUserData
} from '../../message/MessageItemComponent.mocks';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';
import { startCallState, type CallKind } from '../../call/startCallIntent';

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({
		featureCallsEnabled: true,
		featureAudioCallsEnabled: true,
		featureAudioCallsGroupChatsEnabled: true,
		featureVideoCallsEnabled: true,
		featureVideoCallsGroupChatsEnabled: true
	})
}));
vi.mock('../../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: undefined })
}));
vi.mock('../../sessionMenu/SessionMenu', () => ({ SessionMenu: () => null }));
vi.mock('../ChatroomMainInteractionIcon', () => ({
	ChatroomMainInteractionIcon: () => null
}));

const addNotification = vi.fn();
/* StartCallRequest remembers taken history entries by key; MemoryRouter
   names its first entry "default", so every test brings its own key. */
let entry = 0;
const setGesture = (isActive: boolean) =>
	Object.defineProperty(navigator, 'userActivation', {
		value: { isActive },
		configurable: true
	});

const openHeader = ({
	kind,
	modality = 'VIDEO',
	active = true,
	isJoinGroupChatView = false,
	consultant = true
}: {
	kind: CallKind;
	modality?: 'AUDIO' | 'VIDEO';
	active?: boolean;
	isJoinGroupChatView?: boolean;
	consultant?: boolean;
}) => {
	const base = mockActiveSessionGroup();
	const session = {
		...base,
		item: { ...base.item, conversationType: 'SELF_HELP', modality, active }
	} as ExtendedSessionInterface;
	const userData = consultant
		? mockUserData()
		: {
				...mockUserData(),
				grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
			};
	render(
		<MemoryRouter
			initialEntries={[
				{
					pathname: '/sessions/consultant/sessionView/room/1',
					key: `request-${++entry}`,
					state: startCallState(session.item.id as number, kind)
				}
			]}
		>
			<SessionTypeContext.Provider
				value={{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/consultant/sessionView'
				}}
			>
				<MessageContextShell
					activeSession={session}
					userData={userData as never}
				>
					<NotificationsContext.Provider
						value={{ addNotification } as never}
					>
						<GroupChatHeader
							bannedUsers={[]}
							isJoinGroupChatView={isJoinGroupChatView}
							hasUserInitiatedStopOrLeaveRequest={{
								current: false
							}}
						/>
					</NotificationsContext.Provider>
				</MessageContextShell>
			</SessionTypeContext.Provider>
		</MemoryRouter>
	);
};
const callButtons = () =>
	Array.from(
		document.querySelectorAll<HTMLButtonElement>(
			'[data-cy="session-header-video-call-buttons"] button'
		)
	);

beforeEach(() => {
	addNotification.mockReset();
	setGesture(false);
});
afterEach(cleanup);

describe('the group header takes a start-call request', () => {
	/* With a live gesture a request that is taken starts the header's own
	   call; under jsdom (http) its first step is the HTTPS prompt. */
	describe('only for a counsellor in an active chat, not in the join view', () => {
		let confirm: ReturnType<typeof vi.spyOn>;
		beforeEach(() => {
			setGesture(true);
			confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		});
		afterEach(() => confirm.mockRestore());

		it('starts the call for a counsellor in an active chat', async () => {
			openHeader({ kind: 'video', modality: 'VIDEO' });
			await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
		});

		it.each([
			['an advice seeker', { consultant: false }],
			['a chat that has not started', { active: false }],
			['the join view', { isJoinGroupChatView: true }]
		])('takes nothing for %s', async (_label, setup) => {
			openHeader({ kind: 'video', modality: 'VIDEO', ...setup });
			await new Promise((resolve) => setTimeout(resolve, 30));
			expect(confirm).not.toHaveBeenCalled();
			expect(addNotification).not.toHaveBeenCalled();
		});
	});

	it.each([
		['video', 'VIDEO', 0],
		['audio', 'VIDEO', 1],
		['audio', 'AUDIO', 0]
	] as const)(
		'without a live gesture focuses the %s button (%s circle)',
		async (kind, modality, index) => {
			openHeader({ kind, modality });
			await waitFor(() =>
				expect(document.activeElement).toBe(callButtons()[index])
			);
			expect(addNotification).not.toHaveBeenCalled();
		}
	);

	it('warns when the requested kind of call is not allowed in this circle', async () => {
		// An audio circle offers no video call.
		openHeader({ kind: 'video', modality: 'AUDIO' });
		await waitFor(() =>
			expect(addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'directLink.entry.callsDisabled'
				})
			)
		);
	});
});
