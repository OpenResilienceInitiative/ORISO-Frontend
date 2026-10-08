// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Spinner } from './Spinner';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: () => 'Bitte warten …' })
}));
beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => null
	);
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
it('uses the live-chat orbital visual and announces one loading status', () => {
	const { container } = render(<Spinner />);
	expect(container.querySelector('canvas')).not.toBeNull();
	expect(screen.getAllByRole('status')).toHaveLength(1);
	expect(screen.getByRole('status').textContent).toBe('Bitte warten …');
	expect(
		container.querySelector('canvas')?.closest('[aria-hidden="true"]')
	).not.toBeNull();
});

it('renders the existing static orbital when reduced motion is requested', () => {
	const context = new Proxy({} as Record<string, unknown>, {
		get: (target, key) =>
			key in target ? target[key as string] : () => undefined,
		set: (target, key, value) => {
			target[key as string] = value;
			return true;
		}
	});
	vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(
		() => context as never
	);
	const frames = vi.fn();
	vi.stubGlobal('matchMedia', () => ({ matches: true }));
	vi.stubGlobal('requestAnimationFrame', frames);
	const view = render(<Spinner />);
	expect(view.container.querySelector('canvas')).not.toBeNull();
	expect(frames).not.toHaveBeenCalled();
	vi.unstubAllGlobals();
});
