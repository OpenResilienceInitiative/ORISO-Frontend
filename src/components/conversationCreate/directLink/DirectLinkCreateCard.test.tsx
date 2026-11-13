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
	it('sends the typed name and the date/time', async () => {
		create.mockResolvedValue({ id: '1' });
		renderCard();
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.audio' })
		);
		fireEvent.change(screen.getByLabelText('directLink.card.name'), {
			target: { value: 'Termin Frau M.' }
		});
		fireEvent.change(screen.getByLabelText('directLink.card.scheduledAt'), {
			target: { value: '2026-11-20T14:30' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: /directLink.card.create/ })
		);
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				medium: 'AUDIO',
				topicId: 4,
				temporary: true,
				name: 'Termin Frau M.',
				scheduledAt: new Date('2026-11-20T14:30').toISOString()
			})
		);
	});

	it('names the link after its topic when no name is typed', async () => {
		create.mockResolvedValue({ id: '1' });
		renderCard();
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.chat' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: /directLink.card.create/ })
		);
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				medium: 'CHAT',
				topicId: 4,
				temporary: false,
				name: 'Sucht'
			})
		);
	});
});
