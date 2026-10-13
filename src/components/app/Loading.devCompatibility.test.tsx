// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Loading } from './Loading';
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: () => 'Bitte warten …' })
}));
beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => null
	);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});
it('shows the orbital session loader after a short delay until content replaces it', () => {
	const view = render(<Loading />);
	act(() => vi.advanceTimersByTime(200));
	expect(view.container.querySelector('canvas')).not.toBeNull();
	expect(screen.getByRole('status')).toBeTruthy();
	act(() => vi.advanceTimersByTime(3000));
	expect(screen.getByRole('status')).toBeTruthy();
	view.rerender(<p>Conversation ready</p>);
	expect(screen.queryByRole('status')).toBeNull();
	expect(screen.getByText('Conversation ready')).toBeTruthy();
});

it('keeps the inline composer path compact', () => {
	const view = render(<Loading compact />);
	act(() => vi.advanceTimersByTime(200));
	expect(
		screen.getByRole('status').classList.contains('loading--inline')
	).toBe(true);
	expect(
		screen.getByRole('status').classList.contains('loading--small')
	).toBe(true);
	expect(
		view.container.querySelector('canvas')?.closest('[aria-hidden="true"]')
	).not.toBeNull();
});
