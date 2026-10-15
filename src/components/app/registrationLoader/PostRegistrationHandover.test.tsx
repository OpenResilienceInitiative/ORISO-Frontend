// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('./HandoverCarousel', () => ({
	HandoverCarousel: () => <div data-testid="carousel" />
}));
vi.mock('../../stageLayout/StageLayout', () => ({
	StageLayout: ({
		stage,
		children
	}: {
		stage: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<div className="stageLayout">
			{stage}
			{children}
		</div>
	)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const { PostRegistrationHandover } = await import('./PostRegistrationHandover');
const { GlobalComponentContext } = await import(
	'../../../globalState/provider/GlobalComponentContext'
);

const renderHandover = (ready: boolean) =>
	render(
		<MemoryRouter>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div data-testid="brand-stage" /> }}
			>
				<PostRegistrationHandover
					ready={ready}
					onEnter={() => undefined}
				/>
			</GlobalComponentContext.Provider>
		</MemoryRouter>
	);

/**
 * Frank, 2026-10-15: after registering, the handover painted over the red
 * brand stage and the legal links — the same screen the registration form
 * and the live-chat entry room keep inside the split layout.
 */
describe('PostRegistrationHandover', () => {
	afterEach(cleanup);

	it('keeps the brand stage next to the handover while the app prepares', () => {
		renderHandover(false);

		const handover = screen
			.getByTestId('brand-stage')
			.closest('.stageLayout');
		expect(handover).not.toBeNull();
		expect(
			handover?.querySelector('[data-cy="registration-handover"]')
		).not.toBeNull();
	});

	it('does not cover the viewport with a fixed overlay', () => {
		renderHandover(true);

		const node = document.querySelector(
			'[data-cy="registration-handover"]'
		) as HTMLElement;
		expect(getComputedStyle(node).position).not.toBe('fixed');
	});
});
