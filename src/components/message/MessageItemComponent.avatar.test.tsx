// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	mockActiveSessionGroup,
	mockActiveSession1on1,
	mockMessageItemComponentProps
} from './MessageItemComponent.mocks';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));
vi.mock('../../utils/pseudonymGenerator', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../utils/pseudonymGenerator')
	>()),
	renderAvatarSvg: vi.fn(() => Promise.resolve('<svg></svg>'))
}));
afterEach(cleanup);

describe('group message recipient avatar', () => {
	it('renders the author motif instead of the assigned consultant motif', async () => {
		render(
			<MessageContextShell
				activeSession={mockActiveSessionGroup()}
				avatarMembers={[
					{
						_id: '@assigned:example.org',
						avatarKind: 'ICON',
						avatarId: 'fox'
					},
					{
						_id: '@author:example.org',
						avatarKind: 'ICON',
						avatarId: 'owl'
					}
				]}
			>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						userId: '@author:example.org',
						username: 'author',
						message: 'A group message'
					})}
				/>
			</MessageContextShell>
		);
		const avatar = await screen.findByTestId('counsellor-avatar');
		await waitFor(() =>
			expect(avatar.getAttribute('data-avatar-id')).toBe('owl')
		);
	});
	it('does not borrow a motif from a different Matrix homeserver', () => {
		render(
			<MessageContextShell
				activeSession={mockActiveSessionGroup()}
				avatarMembers={[
					{
						_id: '@author:other.org',
						avatarKind: 'ICON',
						avatarId: 'fox'
					}
				]}
			>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						userId: '@author:example.org',
						username: 'author',
						message: 'A group message'
					})}
				/>
			</MessageContextShell>
		);
		expect(screen.queryByTestId('counsellor-avatar')).toBeNull();
		expect(screen.getByTestId('user-avatar')).not.toBeNull();
	});
});

it('does not show the assigned counsellor motif on a historical direct-chat author', () => {
	const session = mockActiveSession1on1();
	session.item.consultantMatrixUserId = '@assigned:example.org';
	session.consultant.avatarKind = 'ICON';
	session.consultant.avatarId = 'fox';
	render(
		<MessageContextShell activeSession={session}>
			<MessageItemComponent
				{...mockMessageItemComponentProps({
					userId: '@previous:example.org',
					username: 'previous',
					message: 'A historical direct message'
				})}
			/>
		</MessageContextShell>
	);
	expect(screen.queryByTestId('counsellor-avatar')).toBeNull();
	expect(screen.getByTestId('user-avatar')).not.toBeNull();
});
