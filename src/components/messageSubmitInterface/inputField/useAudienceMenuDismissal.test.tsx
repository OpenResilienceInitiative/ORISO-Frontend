// @vitest-environment oriso-jsdom
import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useAudienceMenuDismissal } from './useAudienceMenuDismissal';

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
});

const fixture = () => {
	const root = document.createElement('div');
	root.innerHTML =
		'<button aria-haspopup="dialog">All</button><button aria-haspopup="dialog">Open recipients</button><div role="dialog"><button>Close</button></div>';
	const outside = document.createElement('button');
	document.body.append(root, outside);
	const triggers = root.querySelectorAll('button[aria-haspopup]');
	const inside = root.querySelector<HTMLElement>('[role="dialog"] button')!;
	return { root, ref: { current: root }, outside, triggers, inside };
};

describe('audience popup dismissal lifecycle (#1806)', () => {
	it.each([0, 1])(
		'returns focus to opening segment %i when Escape dismisses the open popup',
		(index) => {
			const { ref, triggers, inside } = fixture();
			const opener = triggers[index] as HTMLButtonElement;
			opener.focus();
			const setOpen = vi.fn();
			renderHook(() => useAudienceMenuDismissal(true, ref, setOpen));
			inside.focus();
			const escape = new KeyboardEvent('keydown', {
				key: 'Escape',
				bubbles: true,
				cancelable: true
			});
			document.dispatchEvent(escape);
			expect(escape.defaultPrevented).toBe(true);
			expect(setOpen).toHaveBeenCalledWith(false);
			expect(document.activeElement).toBe(opener);
		}
	);

	it('keeps outside-click dismissal from stealing focus and ignores clicks inside', () => {
		const { ref, triggers, inside, outside } = fixture();
		(triggers[1] as HTMLButtonElement).focus();
		const setOpen = vi.fn();
		renderHook(() => useAudienceMenuDismissal(true, ref, setOpen));
		fireEvent.mouseDown(inside);
		expect(setOpen).not.toHaveBeenCalled();
		outside.focus();
		fireEvent.mouseDown(outside);
		expect(setOpen).toHaveBeenCalledWith(false);
		expect(document.activeElement).toBe(outside);
	});

	it('updates the focus target on reopen and leaves closed/unmounted Escape untouched', () => {
		const { ref, triggers, inside } = fixture();
		(triggers[0] as HTMLButtonElement).focus();
		const setOpen = vi.fn();
		const { rerender, unmount } = renderHook(
			({ open }) => useAudienceMenuDismissal(open, ref, setOpen),
			{ initialProps: { open: true } }
		);
		rerender({ open: false });
		const closedEscape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		document.dispatchEvent(closedEscape);
		expect(closedEscape.defaultPrevented).toBe(false);
		expect(setOpen).not.toHaveBeenCalled();
		(triggers[1] as HTMLButtonElement).focus();
		rerender({ open: true });
		inside.focus();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(document.activeElement).toBe(triggers[1]);
		unmount();
		setOpen.mockClear();
		const unmountedEscape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		document.dispatchEvent(unmountedEscape);
		expect(unmountedEscape.defaultPrevented).toBe(false);
		fireEvent.mouseDown(document.body);
		expect(setOpen).not.toHaveBeenCalled();
	});
});
