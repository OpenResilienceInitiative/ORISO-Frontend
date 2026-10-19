// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
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

/* The closing animation is the module's own; here it is a stand-in that only
   notes it was asked for. */
const play = vi.hoisted(() => vi.fn());
vi.mock('../../transition/closing/useClosingAnimation', () => ({
	useClosingAnimation: () => ({ play })
}));

const { RegistrationHandover } = await import('./RegistrationHandover');
const { GlobalComponentContext } = await import(
	'../../../globalState/provider/GlobalComponentContext'
);

const renderHandover = (
	closing: React.ComponentProps<typeof RegistrationHandover>['closing'],
	onEnter = vi.fn()
) => {
	render(
		<MemoryRouter>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div data-testid="brand-stage" /> }}
			>
				<RegistrationHandover
					ready
					onEnter={onEnter}
					closing={closing}
				/>
			</GlobalComponentContext.Provider>
		</MemoryRouter>
	);
	return onEnter;
};

const gate = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="handover-gate-button"]'
	)!;

/**
 * A person who registered through a group link arrives in the group's entry
 * room, which is another waiting room: there is no message field to end the
 * closing animation on, and waiting for one would hold the cover up for the
 * whole focal wait (Codex on #1766).
 */
describe('RegistrationHandover — where the closing animation ends', () => {
	afterEach(() => {
		cleanup();
		play.mockReset();
	});

	it('closes onto the message field by default, as an enquiry arrives in a chat', async () => {
		play.mockResolvedValue(undefined);
		renderHandover(undefined);

		expect(gate().getAttribute('data-cy-closing')).toBe('messageField');
		await act(async () => {
			fireEvent.click(gate());
		});
		expect(play).toHaveBeenCalledTimes(1);
		expect(play.mock.calls[0][0]).toMatchObject({ focal: 'messageField' });
	});

	it('plays no closing animation when the next screen has no focal to end on', async () => {
		const onEnter = renderHandover(null);

		expect(gate().hasAttribute('data-cy-closing')).toBe(false);
		await act(async () => {
			fireEvent.click(gate());
		});
		expect(play, 'nothing to wait for').not.toHaveBeenCalled();
		expect(onEnter, 'the person goes on at once').toHaveBeenCalledTimes(1);
	});
});
