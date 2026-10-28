// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AUTHORITIES } from '../../globalState';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	MOCK_ASKER_MATRIX_ID,
	MOCK_CONSULTANT_MATRIX_ID,
	mockActiveSession1on1,
	mockMessageItemComponentProps,
	mockUserData
} from './MessageItemComponent.mocks';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'de' },
		t: (key: string, fallback?: string) => fallback ?? key
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));
afterEach(cleanup);

const sessionWithAlias = (
	modality: string,
	displayName: string,
	sessionId = 3363
) => {
	const session = mockActiveSession1on1();
	return {
		...session,
		item: { ...session.item, id: sessionId, conversationType: modality },
		user: { ...session.user, displayName }
	};
};

const aliasMessage = (own = false, sender = MOCK_ASKER_MATRIX_ID) => (
	<MessageItemComponent
		{...mockMessageItemComponentProps({
			userId: sender,
			username: 'unchanged_login_1234',
			displayName: 'Old event name',
			message: 'An ordinary message',
			isMyMessage: own
		})}
	/>
);
const viewer = (own: boolean) =>
	mockUserData(
		own
			? {
					userId: MOCK_ASKER_MATRIX_ID,
					userName: 'unchanged_login_1234',
					displayName: 'Other account name',
					grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
				}
			: {}
	);

describe('session-scoped asker message alias', () => {
	for (const modality of ['LIVE_CHAT', 'AGENCY_COUNSELLING']) {
		for (const own of [false, true]) {
			it(`shows the exact chosen alias for ${own ? 'own' : 'incoming'} ${modality} messages`, () => {
				render(
					<MessageContextShell
						activeSession={sessionWithAlias(
							modality,
							'katze_mika_1234'
						)}
						userData={viewer(own)}
					>
						{aliasMessage(own)}
					</MessageContextShell>
				);
				expect(screen.getByText('katze_mika_1234')).toBeTruthy();
				expect(screen.queryByText('Old event name')).toBeNull();
			});
		}
	}

	it('updates only to the active session alias when the same asker changes sessions', () => {
		const renderSession = (name: string, id: number) => (
			<MessageContextShell
				activeSession={sessionWithAlias('AGENCY_COUNSELLING', name, id)}
			>
				{aliasMessage()}
			</MessageContextShell>
		);
		const view = render(renderSession('First session alias', 3363));
		expect(screen.getByText('First session alias')).toBeTruthy();
		view.rerender(renderSession('Second session alias', 3364));
		expect(screen.getByText('Second session alias')).toBeTruthy();
		expect(screen.queryByText('First session alias')).toBeNull();
	});

	it('keeps event-name fallback when this session has no assigned alias', () => {
		render(
			<MessageContextShell
				activeSession={sessionWithAlias('AGENCY_COUNSELLING', '  ')}
			>
				{aliasMessage()}
			</MessageContextShell>
		);
		expect(screen.getByText('Old event name')).toBeTruthy();
	});

	it('does not assign the asker alias to a different sender', () => {
		render(
			<MessageContextShell
				activeSession={sessionWithAlias(
					'AGENCY_COUNSELLING',
					'Asker alias'
				)}
			>
				{aliasMessage(false, '@another:example.org')}
			</MessageContextShell>
		);
		expect(screen.queryByText('Asker alias')).toBeNull();
		expect(screen.getByText('Old event name')).toBeTruthy();
	});

	it('preserves the counsellor public name for an asker viewer', () => {
		render(
			<MessageContextShell
				activeSession={sessionWithAlias(
					'AGENCY_COUNSELLING',
					'Asker alias'
				)}
				userData={viewer(true)}
			>
				{aliasMessage(false, MOCK_CONSULTANT_MATRIX_ID)}
			</MessageContextShell>
		);
		expect(screen.getByText('Karina P')).toBeTruthy();
		expect(screen.queryByText('Asker alias')).toBeNull();
	});
});
