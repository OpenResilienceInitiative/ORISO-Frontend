// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	mockActiveSessionGroup,
	mockMessageItemComponentProps,
	mockUserData
} from './MessageItemComponent.mocks';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));
afterEach(cleanup);

/*
 * Matrix profiles hold the login name, so after a reload the event's
 * `displayName` is the username ("blinky2"). OBP 2.1 #12: an internal group
 * chat showed that instead of the public display name.
 */
describe('sender name in an internal group chat after reload', () => {
	it('names the counsellor’s own message by their display name', () => {
		render(
			<MessageContextShell
				activeSession={mockActiveSessionGroup()}
				userData={mockUserData({
					userName: 'blinky2',
					displayName: 'Blinky Zwei'
				})}
			>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						isMyMessage: true,
						userId: '@blinky2:example.org',
						username: 'blinky2',
						displayName: 'blinky2',
						message: 'Hallo'
					})}
				/>
			</MessageContextShell>
		);
		expect(screen.queryByText('blinky2')).toBeNull();
		expect(screen.getByText('Blinky Zwei')).toBeTruthy();
	});

	it('names a colleague’s message by the member display name, not the login name', () => {
		render(
			<MessageContextShell
				activeSession={mockActiveSessionGroup()}
				avatarMembers={[
					{
						_id: '@kollege:example.org',
						username: 'kollege7',
						displayName: 'Katrin Kollegin'
					}
				]}
			>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						userId: '@kollege:example.org',
						username: 'kollege7',
						displayName: 'kollege7',
						message: 'Hallo'
					})}
				/>
			</MessageContextShell>
		);
		expect(screen.queryByText('kollege7')).toBeNull();
		expect(screen.getByText('Katrin Kollegin')).toBeTruthy();
	});

	it('falls back to the username when nobody knows a display name', () => {
		render(
			<MessageContextShell activeSession={mockActiveSessionGroup()}>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						userId: '@kollege:example.org',
						username: 'kollege7',
						displayName: 'kollege7',
						message: 'Hallo'
					})}
				/>
			</MessageContextShell>
		);
		expect(screen.getByText('kollege7')).toBeTruthy();
	});
});
