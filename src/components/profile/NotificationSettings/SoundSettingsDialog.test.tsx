// @vitest-environment jsdom
/**
 * #576 — sound settings dialog body: two slots with choices + preview,
 * mention slot offers 'default', message slot does not.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SoundSettingsDialogView } from './SoundSettingsDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

describe('SoundSettingsDialogView', () => {
	afterEach(cleanup);

	it('renders a message slot and a mention slot', () => {
		render(
			<SoundSettingsDialogView
				messageSound="chime"
				mentionSound="default"
				onChange={vi.fn()}
				onPreview={vi.fn()}
			/>
		);
		expect(screen.getByLabelText(/slot\.message/)).toBeTruthy();
		expect(screen.getByLabelText(/slot\.mention/)).toBeTruthy();
	});

	it('reports a slot change with the chosen SoundId', () => {
		const onChange = vi.fn();
		render(
			<SoundSettingsDialogView
				messageSound="chime"
				mentionSound="default"
				onChange={onChange}
				onPreview={vi.fn()}
			/>
		);
		fireEvent.change(screen.getByLabelText(/slot\.message/), {
			target: { value: 'ding' }
		});
		expect(onChange).toHaveBeenCalledWith('message', 'ding');
	});

	it('previews the current sound when ▶ is clicked', () => {
		const onPreview = vi.fn();
		const { container } = render(
			<SoundSettingsDialogView
				messageSound="chime"
				mentionSound="default"
				onChange={vi.fn()}
				onPreview={onPreview}
			/>
		);
		fireEvent.click(
			container.querySelector(
				'[data-cy="sound-preview-message"]'
			) as HTMLButtonElement
		);
		expect(onPreview).toHaveBeenCalledWith('chime');
	});

	it('offers "default" only for the mention slot', () => {
		render(
			<SoundSettingsDialogView
				messageSound="chime"
				mentionSound="default"
				onChange={vi.fn()}
				onPreview={vi.fn()}
			/>
		);
		const messageOptions = Array.from(
			(screen.getByLabelText(/slot\.message/) as HTMLSelectElement)
				.options
		).map((o) => o.value);
		const mentionOptions = Array.from(
			(screen.getByLabelText(/slot\.mention/) as HTMLSelectElement)
				.options
		).map((o) => o.value);
		expect(messageOptions).not.toContain('default');
		expect(mentionOptions).toContain('default');
	});

	it('disables preview for a silent choice', () => {
		const { container } = render(
			<SoundSettingsDialogView
				messageSound="none"
				mentionSound="default"
				onChange={vi.fn()}
				onPreview={vi.fn()}
			/>
		);
		expect(
			(
				container.querySelector(
					'[data-cy="sound-preview-message"]'
				) as HTMLButtonElement
			).disabled
		).toBe(true);
	});
});
