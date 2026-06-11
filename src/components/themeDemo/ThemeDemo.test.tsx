// @vitest-environment jsdom
/**
 * Auth-free theme demo route (decided 2026-06-11, replaces the removed
 * admin replicas — Frontend#144): renders the REAL app's session list
 * and chat room markup with German mock conversations, no login, no
 * API calls. The admin's sandboxed iframe preview points here.
 *
 * Traces: UAT-C.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeDemo } from './ThemeDemo';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}));

describe('ThemeDemo', () => {
	beforeEach(() => {
		vi.spyOn(window, 'fetch' as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document
			.querySelectorAll('meta[name="robots"]')
			.forEach((node) => node.remove());
	});

	it('renders the real session-list markup with mock counselling content', () => {
		const { container } = render(<ThemeDemo />);
		expect(
			container.querySelectorAll('.sessionsListItem').length
		).toBeGreaterThanOrEqual(2);
		expect(
			container.querySelector('.sessionsListItem--active')
		).not.toBeNull();
		expect(screen.getAllByText('Familienberatung').length).toBeGreaterThanOrEqual(2);
		expect(screen.getAllByText('ruhiges Yak Kim').length).toBeGreaterThanOrEqual(1);
	});

	it('renders the real chat markup: incoming and own message bubbles', () => {
		const { container } = render(<ThemeDemo />);
		const bubbles = container.querySelectorAll('.messageItem__message');
		expect(bubbles.length).toBeGreaterThanOrEqual(2);
		expect(
			container.querySelector('.messageItem__message--myMessage')
		).not.toBeNull();
	});

	it('keeps crawlers out (noindex) and never calls the network', () => {
		render(<ThemeDemo />);
		const robots = document.querySelector('meta[name="robots"]');
		expect(robots?.getAttribute('content')).toBe('noindex');
		expect(window.fetch).not.toHaveBeenCalled();
	});
});
