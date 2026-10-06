// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitPracticeMode, enterPracticeMode } from './practiceMode';
import { PracticeProvider } from './PracticeProvider';
import { PracticeSurface } from './PracticeSurface';

// The slot is the integrator's seam for S0's sandbox; stand in for it here.
vi.mock('./PracticeSandboxSlot', () => ({
	PracticeSandboxSlot: () => <div data-testid="sandbox" />
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
	it('renders its children, and nothing else while practice is off', () => {
		const { container } = renderSurface();

		expect(screen.getByText('real app')).toBeTruthy();
		expect(screen.queryByTestId('sandbox')).toBeNull();
		expect(container.textContent).toBe('real app');
	});

	it('keeps its children mounted when practice starts and ends', () => {
		renderSurface();
		const before = screen.getByText('real app');

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));
		expect(screen.getByText('real app')).toBe(before);

		act(() => exitPracticeMode());
		expect(screen.getByText('real app')).toBe(before);
	});

	it('mounts the sandbox slot only while practice is active', () => {
		renderSurface();
		expect(screen.queryByTestId('sandbox')).toBeNull();

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));
		expect(screen.getByTestId('sandbox')).toBeTruthy();

		act(() => exitPracticeMode());
		expect(screen.queryByTestId('sandbox')).toBeNull();
	});
});
