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

	/* ORISO-Frontend#2142: a name and a date/time at creation, both optional. */
	it('takes an optional name and date/time once the medium is chosen', () => {
		const onCreate = vi.fn();
		render(
			<DirectLinkCard
				topics={[{ value: '4', label: 'Sucht' }]}
				onCreate={onCreate}
			/>
		);
		expect(screen.queryByLabelText('directLink.card.name')).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.video' })
		);
		const name = screen.getByLabelText(
			'directLink.card.name'
		) as HTMLInputElement;
		expect(name.placeholder).toBe('Sucht');
		expect(name.maxLength).toBe(100);
		fireEvent.change(name, { target: { value: ' Termin Frau M. ' } });
		fireEvent.change(screen.getByLabelText('directLink.card.scheduledAt'), {
			target: { value: '2026-11-20T14:30' }
		});
		fireEvent.click(create());
		expect(onCreate).toHaveBeenCalledWith({
			topic: '4',
			medium: 'VIDEO',
			temporary: true,
			name: 'Termin Frau M.',
			scheduledAt: new Date('2026-11-20T14:30').toISOString()
		});
	});

	it('leaves name and date/time out when they stay empty', () => {
		const onCreate = vi.fn();
		render(
			<DirectLinkCard
				topics={[{ value: '4', label: 'Sucht' }]}
				onCreate={onCreate}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.chat' })
		);
		fireEvent.click(create());
		expect(onCreate).toHaveBeenCalledWith({
			topic: '4',
			medium: 'CHAT',
			temporary: false
		});
	});

	/* CodeRabbit on #2234: a half-typed date reads as '' with badInput. */
	it('does not create the link while the date/time is incomplete', () => {
		const onCreate = vi.fn();
		render(
			<DirectLinkCard
				topics={[{ value: '4', label: 'Sucht' }]}
				onCreate={onCreate}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.medium.video' })
		);
		const input = screen.getByLabelText(
			'directLink.card.scheduledAt'
		) as HTMLInputElement;
		Object.defineProperty(input, 'validity', {
			configurable: true,
			value: { badInput: true, valid: false }
		});
		fireEvent.click(create());
		expect(onCreate).not.toHaveBeenCalled();
		expect(
			screen.getByText('directLink.card.scheduledAtIncomplete')
		).toBeTruthy();
	});
});
