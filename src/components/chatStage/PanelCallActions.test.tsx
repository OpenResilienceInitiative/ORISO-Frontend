// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelCallActions } from './PanelCallActions';

vi.hoisted(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ({ fillStyle: '', fillRect: () => {} })
	});
});

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const copy = {
	video: 'Start video call',
	audio: 'Start audio call',
	menu: 'Call options',
	participants: '1 participant'
};

afterEach(cleanup);

describe('PanelCallActions', () => {
	it('exposes labelled call buttons and sends the selected call kind', () => {
		const onStartCall = vi.fn();
		render(
			<PanelCallActions
				onStartCall={onStartCall}
				copy={copy}
				participantCount={2}
				width={640}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'Start video call' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Start audio call' })
		);

		expect(onStartCall.mock.calls).toEqual([[true], [false]]);
	});

	it('opens the compact call dialog and restores trigger focus on Escape', () => {
		render(
			<PanelCallActions
				onStartCall={vi.fn()}
				copy={copy}
				participantCount={2}
				width={320}
			/>
		);

		const trigger = screen.getByRole('button', { name: 'Call options' });
		fireEvent.click(trigger);

		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(
			screen.getByRole('dialog', { name: 'Call options' })
		).toBeTruthy();

		fireEvent.keyDown(document, { key: 'Escape' });

		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	});

	it('keeps unavailable calls discoverable with an accessible reason', () => {
		render(
			<PanelCallActions
				onStartCall={vi.fn()}
				copy={copy}
				participantCount={1}
				width={640}
			/>
		);

		const video = screen.getByRole('button', {
			name: 'Start video call – 1 participant'
		}) as HTMLButtonElement;
		expect(video.disabled).toBe(true);
	});

	it('includes the unavailable reason in the compact dialog', () => {
		render(
			<PanelCallActions
				onStartCall={vi.fn()}
				copy={copy}
				participantCount={1}
				width={320}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Call options' }));

		const video = screen.getByRole('button', {
			name: /Start video call 1 participant/
		}) as HTMLButtonElement;
		expect(video.disabled).toBe(true);
	});
});
