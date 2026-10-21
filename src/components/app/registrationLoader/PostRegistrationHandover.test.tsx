// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
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

const renderHandover = (ready: boolean, onEnter = () => undefined) =>
	render(
		<MemoryRouter>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div data-testid="brand-stage" /> }}
			>
				<PostRegistrationHandover ready={ready} onEnter={onEnter} />
			</GlobalComponentContext.Provider>
		</MemoryRouter>
	);

const gate = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="handover-gate-button"]'
	)!;

/**
 * Frank, 2026-10-15: after registering, the handover painted over the red
 * brand stage and the legal links — the same screen the registration form
 * and the live-chat entry room keep. Where the stage sits is the Storybook
 * contract's job; this proves what the person can do on the screen.
 */
describe('PostRegistrationHandover', () => {
	afterEach(cleanup);

	it('shows the brand stage together with the handover', () => {
		renderHandover(false);

		expect(screen.getByTestId('brand-stage')).toBeDefined();
		expect(
			document.querySelector('[data-cy="registration-handover"]')
		).not.toBeNull();
	});

	it('keeps the gate shut while the app prepares', () => {
		const onEnter = vi.fn();
		renderHandover(false, onEnter);

		expect(gate().disabled).toBe(true);
		fireEvent.click(gate());
		expect(onEnter).not.toHaveBeenCalled();
	});

	it('lets the person in once, however often they click', () => {
		const onEnter = vi.fn();
		renderHandover(true, onEnter);

		expect(gate().disabled).toBe(false);
		fireEvent.click(gate());
		fireEvent.click(gate());
		expect(onEnter).toHaveBeenCalledTimes(1);
	});
});
