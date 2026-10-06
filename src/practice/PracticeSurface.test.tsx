// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitPracticeMode, enterPracticeMode } from './practiceMode';
import { PracticeProvider } from './PracticeProvider';
import { PracticeSurface } from './PracticeSurface';

// The slot is the integrator's seam for S0's sandbox; stand in for it here.
vi.mock('./PracticeSandboxSlot', () => ({
	PracticeSandboxSlot: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="sandbox">{children}</div>
	)
}));

afterEach(() => {
	cleanup();
	exitPracticeMode();
});

const renderSurface = () =>
	render(
		<PracticeProvider>
			<PracticeSurface>
				<p>real app</p>
			</PracticeSurface>
		</PracticeProvider>
	);

describe('PracticeSurface', () => {
	it('renders its children untouched while practice is off', () => {
		const { container } = renderSurface();

		expect(screen.getByText('real app')).toBeTruthy();
		expect(screen.queryByTestId('sandbox')).toBeNull();
		expect(container.textContent).toBe('real app');
	});

	it('puts its children inside the sandbox slot only while practice is active', () => {
		renderSurface();
		expect(screen.queryByTestId('sandbox')).toBeNull();

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));
		expect(
			within(screen.getByTestId('sandbox')).getByText('real app')
		).toBeTruthy();

		act(() => exitPracticeMode());
		expect(screen.queryByTestId('sandbox')).toBeNull();
		expect(screen.getByText('real app')).toBeTruthy();
	});
});
