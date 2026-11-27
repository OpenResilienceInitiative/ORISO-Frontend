// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
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
import { subscribeToTourEvent } from '../../productTour/tourEvents';
import {
	enterPracticeMode,
	exitPracticeMode
} from '../../../practice/practiceMode';
import { PRACTICE_TOUR_EVENTS } from '../../../practice/practiceTourEvents';
import {
	getPracticeCallState,
	leavePracticeCall
} from '../../../practice/practiceCallStore';
import { callManager } from '../../../services/CallManager';

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
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

const renderHeader = () => {
	const base = mockActiveSessionGroup();
	const session = {
		...base,
		item: { ...base.item, conversationType: 'SELF_HELP', modality: 'VIDEO' }
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
	const buttons = document.querySelector(
		'[data-tour-target="groupchat-call-button"]'
	);
	expect(buttons).not.toBeNull();
	return buttons!.querySelector<HTMLElement>(
		'button, [role="button"], .button__item'
	)!;
};

/** Every way the real handler reaches the call: prompts, media, manager. */
const callPath = {
	confirm: vi.fn(() => false),
	alert: vi.fn(),
	getUserMedia: vi.fn(async () => {
		throw new Error('no media in this test');
	})
};
let callStarts = 0;
let stopListening = () => undefined as void;

beforeEach(() => {
	Object.values(callPath).forEach((spy) => spy.mockClear());
	vi.spyOn(window, 'confirm').mockImplementation(callPath.confirm);
	vi.spyOn(window, 'alert').mockImplementation(callPath.alert);
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: { getUserMedia: callPath.getUserMedia }
	});
	callStarts = 0;
	stopListening = subscribeToTourEvent(
		PRACTICE_TOUR_EVENTS.circleCallStarted,
		() => {
			callStarts += 1;
		}
	);
});

afterEach(() => {
	leavePracticeCall();
	stopListening();
	cleanup();
	exitPracticeMode();
	vi.restoreAllMocks();
});

const macrotask = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

it('starts no call in practice: the click opens the practice call stage (FE#2545 D3)', async () => {
	enterPracticeMode({ tourId: 'consultant-group-circle' });
	const startCall = vi.spyOn(callManager, 'startCall');
	const button = renderHeader();

	await act(async () => {
		fireEvent.click(button);
	});
	await macrotask();

	expect(callPath.getUserMedia).not.toHaveBeenCalled();
	expect(callPath.confirm).not.toHaveBeenCalled();
	expect(callPath.alert).not.toHaveBeenCalled();
	expect(startCall).not.toHaveBeenCalled();
	expect(callManager.hasActiveCall()).toBe(false);
	// The stage asks for the camera itself once it shows (not mounted here).
	expect(getPracticeCallState().status).toBe('open');
	expect(callStarts).toBe(1);
});

it('keeps the real call start outside practice', async () => {
	const button = renderHeader();

	await act(async () => {
		fireEvent.click(button);
	});
	await macrotask();

	// jsdom runs on http: the real handler stops at its HTTPS prompt.
	expect(callPath.confirm).toHaveBeenCalledTimes(1);
	expect(callStarts).toBe(0);
	expect(getPracticeCallState().status).toBe('closed');
});
