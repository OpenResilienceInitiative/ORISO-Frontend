// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { DirectLinkCreateCard } from './DirectLinkCreateCard';

const create = vi.fn();
vi.mock('./useDirectLinks', () => ({
	useDirectLinks: () => ({ create })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
/* The dialog has its own tests; here it hands over what a counsellor chose. */
const dialog = vi.hoisted(() => ({
	props: null as any,
	value: null as any
}));
vi.mock('../../directInvitation/InvitationDialog', () => ({
	InvitationDialog: (props: any) => {
		dialog.props = props;
		return (
			<div data-testid="invitation-dialog">
				{props.error && <p role="alert">{props.error}</p>}
				<button
					type="button"
					onClick={() => props.onSubmit(dialog.value)}
				>
					submit-invitation
				</button>
			</div>
		);
	}
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const renderCard = () =>
	render(
		<DirectLinkCreateCard
			topics={[{ value: '4', label: 'Sucht' }]}
			agencies={[{ id: 11, topicIds: [4] }]}
			media={['CHAT', 'AUDIO', 'VIDEO']}
			onDone={vi.fn()}
			onCreated={vi.fn()}
		/>
	);

/* ORISO-Frontend#2142: the typed name wins over the topic label. */
describe('DirectLinkCreateCard', () => {
	/* #2252: the card picks topic, medium and name; the shared dialog adds
	   the appointment, the validity, who may come in and knocking. */
	it('opens the Direkteinladung dialog and sends its appointment and settings', async () => {
		create.mockResolvedValue({ id: '1' });
		dialog.value = {
			appointment: {
				start: new Date('2026-11-20T14:30:00Z'),
				end: new Date('2026-11-20T15:30:00Z')
			},
			link: { validityMinutes: 60, access: 'guests', knock: false }
		};
		renderCard();
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.audio' })
		);
		expect(
			screen.queryByLabelText('directLink.card.scheduledAt')
		).toBeNull();
		fireEvent.change(screen.getByLabelText('directLink.card.name'), {
			target: { value: 'Termin Frau M.' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: /directLink.card.create/ })
		);
		expect(create).not.toHaveBeenCalled();
		expect(dialog.props.variant).toBe('invitation');

		fireEvent.click(screen.getByText('submit-invitation'));

		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				medium: 'AUDIO',
				topicId: 4,
				temporary: true,
				name: 'Termin Frau M.',
				appointment: {
					startTime: '2026-11-20T14:30:00.000Z',
					endTime: '2026-11-20T15:30:00.000Z'
				},
				validityAfterEndMinutes: 60,
				accessMode: 'GUESTS_ONLY',
				knock: false
			})
		);
		await waitFor(() =>
			expect(screen.queryByTestId('invitation-dialog')).toBeNull()
		);
	});

	it('keeps the dialog open and says so when creating fails', async () => {
		create.mockRejectedValue(new Error('x'));
		dialog.value = {
			appointment: null,
			link: { validityMinutes: null, access: 'both', knock: true }
		};
		renderCard();
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.video' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: /directLink.card.create/ })
		);
		fireEvent.click(screen.getByText('submit-invitation'));

		expect((await screen.findByRole('alert')).textContent).toBe(
			'directLink.card.createFailed'
		);
		expect(screen.getByTestId('invitation-dialog')).toBeTruthy();
	});

	it('names the link after its topic when no name is typed', async () => {
		create.mockResolvedValue({ id: '1' });
		renderCard();
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.chat' })
		);
		dialog.value = {
			appointment: null,
			link: { validityMinutes: null, access: 'accounts', knock: true }
		};
		fireEvent.click(
			screen.getByRole('button', { name: /directLink.card.create/ })
		);
		fireEvent.click(screen.getByText('submit-invitation'));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				medium: 'CHAT',
				topicId: 4,
				temporary: false,
				name: 'Sucht',
				accessMode: 'ACCOUNTS_ONLY',
				knock: true
			})
		);
	});
});
