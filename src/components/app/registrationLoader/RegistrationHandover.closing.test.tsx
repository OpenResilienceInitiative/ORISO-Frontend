// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
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

/**
 * The gate opens itself after a long wait as an escape hatch, while the app is
 * still loading. A click then has no destination to close onto: the handover is
 * only given up once the app is ready, so the animation would cover the screen,
 * wait for a message field that is not there, and reveal the same room again
 * (Codex on #1766).
 */
describe('RegistrationHandover — the gate that opened itself', () => {
	const SLOW_AFTER_MS = 20000;
	const tree = (ready: boolean, onEnter: () => void) => (
		<MemoryRouter>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div data-testid="brand-stage" /> }}
			>
				<RegistrationHandover ready={ready} onEnter={onEnter} />
			</GlobalComponentContext.Provider>
		</MemoryRouter>
	);

	afterEach(() => {
		cleanup();
		play.mockReset();
		vi.useRealTimers();
	});

	const slowGate = async (onEnter = vi.fn()) => {
		vi.useFakeTimers();
		const view = render(tree(false, onEnter));
		await act(async () => {
			vi.advanceTimersByTime(SLOW_AFTER_MS);
		});
		return { onEnter, ...view };
	};

	it('plays no closing animation while the app is not ready, and lets the person go on', async () => {
		const { onEnter } = await slowGate();
		expect(gate().getAttribute('data-cy-state')).toBe('slow');
		expect(gate().hasAttribute('data-cy-closing')).toBe(false);

		await act(async () => {
			fireEvent.click(gate());
		});
		expect(
			play,
			'there is no message field to end on yet'
		).not.toHaveBeenCalled();
		expect(
			onEnter,
			'the intent is kept; the app closes the room when ready'
		).toHaveBeenCalledTimes(1);
	});

	it('closes onto the message field again once the app is ready', async () => {
		play.mockResolvedValue(undefined);
		const { rerender } = await slowGate();
		rerender(tree(true, vi.fn()));

		expect(gate().getAttribute('data-cy-state')).toBe('ready');
		expect(gate().getAttribute('data-cy-closing')).toBe('messageField');
		await act(async () => {
			fireEvent.click(gate());
		});
		expect(play).toHaveBeenCalledTimes(1);
	});
});
