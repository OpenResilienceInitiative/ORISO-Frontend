// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { GroupChatHeader } from './index';
import {
	SessionTypeContext,
	type ExtendedSessionInterface
} from '../../../globalState';
import { MessageContextShell } from '../../message/messageStoryShell';
import { mockActiveSessionGroup } from '../../message/MessageItemComponent.mocks';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';

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
	ChatroomMainInteractionIcon: ({
		addLabel,
		onAddClick
	}: {
		addLabel: string;
		onAddClick?: () => void;
	}) => (
		<button type="button" disabled={!onAddClick} onClick={onAddClick}>
			{addLabel}
		</button>
	)
}));
vi.mock('../../managePeople/ManagePeopleDialog', () => ({
	ManagePeopleDialog: ({ source }: { source: { kind: string } }) => (
		<div role="dialog">{source.kind}</div>
	)
}));

afterEach(cleanup);

const renderHeader = (conversationType: 'INTERNAL_GROUP' | 'SELF_HELP') => {
	const base = mockActiveSessionGroup();
	const session = {
		...base,
		item: { ...base.item, active: true, conversationType }
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
					<GroupChatHeader
						bannedUsers={[]}
						isJoinGroupChatView={false}
						hasUserInitiatedStopOrLeaveRequest={{ current: false }}
					/>
				</MessageContextShell>
			</SessionTypeContext.Provider>
		</MemoryRouter>
	);
};

it('opens "Personen verwalten" from the plus of a running internal chat (#2023)', () => {
	renderHeader('INTERNAL_GROUP');

	fireEvent.click(
		screen.getByRole('button', { name: 'managePeople.internalChat.title' })
	);

	expect(screen.getByRole('dialog').textContent).toBe('internalChat');
});

it('keeps the plus disabled in a self-help group', () => {
	renderHeader('SELF_HELP');

	expect(
		screen.getByRole('button', {
			name: 'sessionHeader.supervisor.add.disabledUnavailable'
		})
	).toHaveProperty('disabled', true);
	expect(screen.queryByRole('dialog')).toBeNull();
});
