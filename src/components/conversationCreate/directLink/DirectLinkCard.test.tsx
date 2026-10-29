// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { DirectLinkCard } from './DirectLinkCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const create = () =>
	screen.getByRole('button', { name: /directLink.card.create/ });

describe('DirectLinkCard', () => {
	it('offers the media as toggle buttons', () => {
		render(<DirectLinkCard topics={[]} onCreate={vi.fn()} />);
		const video = screen.getByRole('button', {
			name: 'directLink.medium.video'
		});
		expect(video.getAttribute('aria-pressed')).toBe('false');
		fireEvent.click(video);
		expect(video.getAttribute('aria-pressed')).toBe('true');
		expect(screen.queryByRole('radio')).toBeNull();
	});

	it('takes a single topic that arrives after the first render', () => {
		const onCreate = vi.fn();
		const { rerender } = render(
			<DirectLinkCard topics={[]} onCreate={onCreate} />
		);
		rerender(
			<DirectLinkCard
				topics={[{ value: '4', label: 'Sucht' }]}
				onCreate={onCreate}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.chat' })
		);
		fireEvent.click(create());
		expect(onCreate).toHaveBeenCalledWith(
			expect.objectContaining({ topic: '4', medium: 'CHAT' })
		);
	});

	it('says when the topics failed to load and offers a retry', () => {
		const onRetryTopics = vi.fn();
		render(
			<DirectLinkCard
				topics={[]}
				onCreate={vi.fn()}
				topicsLoadFailed
				onRetryTopics={onRetryTopics}
			/>
		);
		expect(screen.getByRole('alert').textContent).toContain(
			'groupChat.loadError.topics'
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'groupChat.loadError.retry' })
		);
		expect(onRetryTopics).toHaveBeenCalledOnce();
	});
});
