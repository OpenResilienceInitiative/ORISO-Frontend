// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockMessageItemComponentProps
} from './MessageItemComponent.mocks';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'de' },
		t: (key: string, options?: { name?: string } | string) =>
			typeof options === 'object' && options?.name
				? `${key}:${options.name}`
				: key
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));
afterEach(cleanup);

/* #2494 *9 review: whose message is readable again follows the same name
   rules as a bubble (#1486), and the notice is a system message. */
const session = (user: Record<string, unknown>) => {
	const base = mockActiveSession1on1();
	return { ...base, user: { ...base.user, ...user } };
};

const notice = (
	targetSenderId: string,
	extra: Record<string, unknown> = {}
) => (
	<MessageItemComponent
		{...mockMessageItemComponentProps({
			_id: '$redaction',
			t: 'blur-removed',
			message: '',
			isMyMessage: false,
			userId: '@karina:hs',
			displayName: 'Karina P',
			username: 'karina',
			blurRemoved: {
				targetEventId: '$msg',
				targetSenderId,
				targetSenderName: 'matrix_login_4711'
			},
			...extra
		} as never)}
	/>
);

describe('blur-removed notice (#2494 *9)', () => {
	it("names the session's asker by the session alias, not the Matrix login", () => {
		render(
			<MessageContextShell
				activeSession={session({ displayName: 'katze_mika_1234' })}
			>
				{notice(MOCK_ASKER_MATRIX_ID)}
			</MessageContextShell>
		);
		expect(
			screen.getByText('message.blurRemoved.text:katze_mika_1234')
		).toBeTruthy();
		expect(screen.queryByText(/matrix_login_4711/)).toBeNull();
	});

	it('shows the deleted-guest label for a deleted asker', () => {
		render(
			<MessageContextShell
				activeSession={session({
					displayName: 'katze_mika_1234',
					deleted: true
				})}
			>
				{notice(MOCK_ASKER_MATRIX_ID)}
			</MessageContextShell>
		);
		expect(
			screen.getByText(
				'message.blurRemoved.text:temporaryAccount.deletedGuest'
			)
		).toBeTruthy();
	});

	it('falls back to the anonymous sentence when the asker has no alias', () => {
		render(
			<MessageContextShell activeSession={session({ displayName: ' ' })}>
				{notice(MOCK_ASKER_MATRIX_ID)}
			</MessageContextShell>
		);
		expect(
			screen.getByText('message.blurRemoved.textAnonymous')
		).toBeTruthy();
	});

	it('keeps the member name for anyone else', () => {
		render(
			<MessageContextShell
				activeSession={session({ displayName: 'katze_mika_1234' })}
			>
				{notice('@colleague:hs')}
			</MessageContextShell>
		);
		expect(
			screen.getByText('message.blurRemoved.text:matrix_login_4711')
		).toBeTruthy();
	});

	it('is hidden with the other system messages', () => {
		const { container } = render(
			<MessageContextShell
				activeSession={session({ displayName: 'katze_mika_1234' })}
			>
				{notice(MOCK_ASKER_MATRIX_ID, { hideSystemMessages: true })}
			</MessageContextShell>
		);
		expect(
			container.querySelector('[data-cy="blur-removed-notice"]')
		).toBeNull();
	});
});
