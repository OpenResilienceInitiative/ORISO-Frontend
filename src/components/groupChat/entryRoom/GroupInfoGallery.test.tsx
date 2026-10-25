// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const TRANSLATIONS: Record<string, string> = {
	'groupChat.info.gallery.steps.formats.title': 'So findet die Gruppe statt',
	'groupChat.info.gallery.steps.alias.title': 'Bitte nur mit Alias',
	'groupChat.info.gallery.steps.dates.title': 'Neue Termine, neue Links'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string | Record<string, unknown>) =>
			TRANSLATIONS[key] ??
			(typeof fallback === 'string'
				? fallback
				: ((fallback?.defaultValue as string) ?? key))
	})
}));

const { GroupInfoGallery } = await import('./GroupInfoGallery');

/** The panel asks the platform before it animates; say "reduce" by default so
    the way back is synchronous and the assertion is about the callback, not
    about a timer. */
const stubReducedMotion = (matches: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue({
			matches,
			media: '(prefers-reduced-motion: reduce)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		} as unknown as MediaQueryList)
	);

describe('GroupInfoGallery', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('shows the three explainer cards', () => {
		stubReducedMotion(true);
		const { container } = render(<GroupInfoGallery onBack={vi.fn()} />);

		expect(
			container.querySelector('[data-cy="group-info-gallery"]')
		).not.toBeNull();
		const cards = container.querySelectorAll('[data-cy^="handover-card-"]');
		expect(cards).toHaveLength(3);
		expect(container.textContent).toContain('So findet die Gruppe statt');
		expect(container.textContent).toContain('Bitte nur mit Alias');
		expect(container.textContent).toContain('Neue Termine, neue Links');
		/* The motifs carry meaning of their own, so each one is described
		   rather than hidden from a screen reader. */
		const described = [...container.querySelectorAll('img')].filter(
			(img) => (img.getAttribute('alt') || '').length > 20
		);
		expect(described).toHaveLength(3);
	});

	it('goes back to the waiting room from the back button', () => {
		stubReducedMotion(true);
		const onBack = vi.fn();
		render(<GroupInfoGallery onBack={onBack} />);

		fireEvent.click(screen.getByTestId('group-info-back'));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('goes back on Escape', () => {
		stubReducedMotion(true);
		const onBack = vi.fn();
		render(<GroupInfoGallery onBack={onBack} />);

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('lets the slide back play before it returns', () => {
		vi.useFakeTimers();
		stubReducedMotion(false);
		const onBack = vi.fn();
		render(<GroupInfoGallery onBack={onBack} />);

		fireEvent.click(screen.getByTestId('group-info-back'));
		expect(onBack).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(400);
		});
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('shows only the cards — the dates have their own view (#1689)', () => {
		stubReducedMotion(true);
		const { container } = render(<GroupInfoGallery onBack={vi.fn()} />);
		expect(
			container.querySelector('[data-cy="group-info-upcoming"]')
		).toBeNull();
		expect(screen.queryByText('Nächste Termine')).toBeNull();
	});
});
