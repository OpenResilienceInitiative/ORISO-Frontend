// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import {
	registerFloatingSurface,
	resetFloatingSurfaces,
	useFloatingSurfaces,
	useRegisterFloatingSurface
} from './floatingSurfaces';

describe('floating surfaces registry', () => {
	afterEach(() => resetFloatingSurfaces());

	it('lists a surface while it is registered and forgets it afterwards', () => {
		const { result } = renderHook(() => useFloatingSurfaces());
		expect(result.current).toEqual([]);

		let release = () => {};
		act(() => {
			release = registerFloatingSurface('call-dock');
		});
		expect(result.current).toEqual(['call-dock']);

		act(() => release());
		expect(result.current).toEqual([]);
	});

	it('keeps a surface while a second holder of the same id is still mounted', () => {
		const { result } = renderHook(() => useFloatingSurfaces());
		let first = () => {};
		let second = () => {};
		act(() => {
			first = registerFloatingSurface('channel-switcher');
			second = registerFloatingSurface('channel-switcher');
		});
		act(() => first());
		expect(result.current).toEqual(['channel-switcher']);
		act(() => first());
		expect(result.current).toEqual(['channel-switcher']);
		act(() => second());
		expect(result.current).toEqual([]);
	});

	it('registers from a component only while it says it is shown', () => {
		const list = renderHook(() => useFloatingSurfaces());
		const holder = renderHook(
			({ shown }) => useRegisterFloatingSurface('call-widget', shown),
			{ initialProps: { shown: false } }
		);
		expect(list.result.current).toEqual([]);

		holder.rerender({ shown: true });
		expect(list.result.current).toEqual(['call-widget']);

		holder.unmount();
		expect(list.result.current).toEqual([]);
	});
});
