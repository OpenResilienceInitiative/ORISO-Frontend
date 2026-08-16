// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Button imports OVERLAY_RESET_TIME from Overlay, and Overlay's module graph
   reaches lottie-web, which throws on import under jsdom (no canvas context).
   Stub the one constant rather than dragging the animation player in. */
vi.mock('../overlay/Overlay', () => ({ OVERLAY_RESET_TIME: 10000 }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback })
}));

vi.mock('../../resources/img/icons/reload.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock calls
   above, otherwise the real Overlay module (and lottie-web) loads first. */
import { Button, BUTTON_TYPES } from './Button';

const OVERLAY_RESET_TIME = 10000;

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Button — AUTO_CLOSE timing', () => {
	it('still closes after the shared overlay reset time by default', () => {
		const buttonHandle = vi.fn();
		render(
			<Button
				item={{ type: BUTTON_TYPES.AUTO_CLOSE, label: 'Weiter' }}
				buttonHandle={buttonHandle}
			/>
		);

		act(() => vi.advanceTimersByTime(OVERLAY_RESET_TIME - 1));
		expect(buttonHandle).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(1));
		expect(buttonHandle).toHaveBeenCalledTimes(1);
	});

	it('honours a shorter per-button close time', () => {
		/* ADR-018 §10: the enquiry send confirmation closes when the first
		   Erstantwort bubble is up, with a ~3 s upper bound — not after the
		   fixed 10 s that made the person stare at a modal while the answer was
		   already waiting behind it. */
		const buttonHandle = vi.fn();
		render(
			<Button
				item={{
					type: BUTTON_TYPES.AUTO_CLOSE,
					label: 'Weiter',
					autoCloseMs: 3000
				}}
				buttonHandle={buttonHandle}
			/>
		);

		act(() => vi.advanceTimersByTime(2999));
		expect(buttonHandle).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(1));
		expect(buttonHandle).toHaveBeenCalledTimes(1);
	});

	it('clears its timer on unmount so a closed overlay cannot fire late', () => {
		const buttonHandle = vi.fn();
		const { unmount } = render(
			<Button
				item={{
					type: BUTTON_TYPES.AUTO_CLOSE,
					label: 'Weiter',
					autoCloseMs: 3000
				}}
				buttonHandle={buttonHandle}
			/>
		);

		unmount();
		act(() => vi.advanceTimersByTime(10_000));
		expect(buttonHandle).not.toHaveBeenCalled();
	});
});
