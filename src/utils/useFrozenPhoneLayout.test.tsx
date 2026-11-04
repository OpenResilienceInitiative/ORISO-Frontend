// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
	setEmbeddedComposerExpanded,
	useFrozenPhoneLayout
} from './embeddedComposerFullscreen';

afterEach(() => {
	act(() => setEmbeddedComposerExpanded(false));
	cleanup();
});

describe('useFrozenPhoneLayout', () => {
	it('follows the live layout while nothing is expanded', () => {
		const { result, rerender } = renderHook(
			({ phone }) => useFrozenPhoneLayout(phone),
			{ initialProps: { phone: true } }
		);
		expect(result.current).toBe(true);
		rerender({ phone: false });
		expect(result.current).toBe(false);
	});

	it('keeps the phone layout while the widened frame crosses the breakpoint', () => {
		const { result, rerender } = renderHook(
			({ phone }) => useFrozenPhoneLayout(phone),
			{ initialProps: { phone: true } }
		);
		act(() => setEmbeddedComposerExpanded(true));
		rerender({ phone: false }); // frame widened past 900px
		expect(result.current).toBe(true);
	});

	it('stays frozen after collapse until the frame is narrow again', () => {
		const { result, rerender } = renderHook(
			({ phone }) => useFrozenPhoneLayout(phone),
			{ initialProps: { phone: true } }
		);
		act(() => setEmbeddedComposerExpanded(true));
		rerender({ phone: false });
		act(() => setEmbeddedComposerExpanded(false));
		expect(result.current).toBe(true); // frame is still wide: no remount yet
		rerender({ phone: true }); // frame shrank back
		expect(result.current).toBe(true);
		rerender({ phone: false }); // released: follows live again
		expect(result.current).toBe(false);
	});
});
