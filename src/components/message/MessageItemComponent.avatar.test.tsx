// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import { SUPERVISOR_FEEDBACK_PREFIX } from './messageConstants';
import { SupervisionPeopleContext } from '../supervisionPanel/SupervisionPeopleContext';
import type { SupervisionPeople } from '../supervisionPanel/supervisionPeople';
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

it('shows a historical direct-chat counsellor as initials on primary, never the assigned motif', () => {
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
	const avatar = screen.getByTestId('counsellor-avatar');
	expect(avatar.getAttribute('data-avatar-kind')).toBe('INITIALS');
	expect(avatar.getAttribute('data-avatar-id')).toBeNull();
});

it('renders an own counsellor message on primary even without a saved choice', () => {
	render(
		<MessageContextShell activeSession={mockActiveSession1on1()}>
			<MessageItemComponent
				{...mockMessageItemComponentProps({
					userId: '@assigned:example.org',
					username: 'assigned',
					message: 'An own counsellor message',
					isMyMessage: true
				})}
			/>
		</MessageContextShell>
	);
	expect(
		screen.getByTestId('counsellor-avatar').getAttribute('data-avatar-kind')
	).toBe('INITIALS');
});

describe('supervision side room (FE#2344)', () => {
	const MONA = '@mona.simpson_at_trail.ist:example.org';
	const people: SupervisionPeople = new Map([
		[
			MONA,
			{
				matrixUserId: MONA,
				role: 'supervisor',
				name: 'Mona Simpson (trail.ist)',
				firstName: 'Mona',
				lastName: 'Simpson',
				choice: { kind: 'initials' }
			}
		]
	]);
	const feedback = () =>
		mockMessageItemComponentProps({
			userId: MONA,
			username: 'mona.simpson_at_trail.ist',
			message: `${SUPERVISOR_FEEDBACK_PREFIX} Deine Nachricht ist angekommen.`
		});

	it('shows the supervisor with the person avatar and name of the panel header', () => {
		const { container } = render(
			<MessageContextShell activeSession={mockActiveSession1on1()}>
				<SupervisionPeopleContext.Provider value={people}>
					<MessageItemComponent {...feedback()} />
				</SupervisionPeopleContext.Provider>
			</MessageContextShell>
		);
		expect(
			container.querySelector('.messageItem__supervisionAvatar')
		).toBeNull();
		const avatar = screen.getByTestId('counsellor-avatar');
		expect(avatar.getAttribute('data-avatar-kind')).toBe('INITIALS');
		expect(avatar.textContent).toContain('MS');
		expect(
			screen.getAllByText('Mona Simpson (trail.ist)').length
		).toBeGreaterThan(0);
	});

	it('keeps the role glyph outside the side room', () => {
		const { container } = render(
			<MessageContextShell activeSession={mockActiveSession1on1()}>
				<MessageItemComponent {...feedback()} />
			</MessageContextShell>
		);
		expect(
			container.querySelector('.messageItem__supervisionAvatar')
		).not.toBeNull();
	});
});
