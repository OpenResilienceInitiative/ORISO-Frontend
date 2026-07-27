// @vitest-environment jsdom
/**
 * Global DND control — presentational contract: shows the options and reports
 * the chosen one; renders the active-until state when DND is set.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DoNotDisturbControlView } from './DoNotDisturbControl';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) =>
			opts && 'time' in opts ? `${key}:${opts.time}` : key
	})
}));

vi.mock('../../headline/Headline', () => ({
	Headline: ({ text }: { text: string }) => <h5>{text}</h5>
}));
vi.mock('../../text/Text', () => ({
	Text: ({ text }: { text: string }) => <p>{text}</p>
}));

describe('DoNotDisturbControlView', () => {
	afterEach(cleanup);

	it('renders all four options and reports the selected one', () => {
		const onSelect = vi.fn();
		render(<DoNotDisturbControlView dndUntil={null} onSelect={onSelect} />);

		['off', '1h', '8h', 'tomorrow'].forEach((option) =>
			expect(
				screen.getByText(`profile.notifications.dnd.option.${option}`)
			).toBeTruthy()
		);

		fireEvent.click(
			screen.getByText('profile.notifications.dnd.option.8h')
		);
		expect(onSelect).toHaveBeenCalledWith('8h');
	});

	it('shows the description when DND is off', () => {
		render(<DoNotDisturbControlView dndUntil={null} onSelect={vi.fn()} />);
		expect(
			screen.getByText('profile.notifications.dnd.description')
		).toBeTruthy();
	});

	it('shows the active-until line when DND is set in the future', () => {
		const future = new Date(Date.now() + 3600_000).toISOString();
		render(
			<DoNotDisturbControlView dndUntil={future} onSelect={vi.fn()} />
		);
		expect(
			screen.getByText(/profile\.notifications\.dnd\.activeUntil:/)
		).toBeTruthy();
	});
});
