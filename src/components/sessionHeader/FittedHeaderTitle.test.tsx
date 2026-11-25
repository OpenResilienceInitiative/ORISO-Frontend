// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { FittedHeaderTitle } from './FittedHeaderTitle';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('FittedHeaderTitle', () => {
	it('keeps the complete accessible title and ellipsis styling when ResizeObserver is unavailable', () => {
		vi.stubGlobal('ResizeObserver', undefined);
		const title = 'Ein besonders langer Name für die Beratung';
		const view = render(<FittedHeaderTitle>{title}</FittedHeaderTitle>);
		const heading = screen.getByRole('heading', { name: title });
		expect(heading.getAttribute('title')).toBe(title);
		expect(
			heading.querySelector('.fittedHeaderTitle__text')?.textContent
		).toBe(title);
		expect(
			view.container
				.querySelector('[aria-hidden="true"]')
				?.getAttribute('data-title')
		).toBe(title);
		fireEvent(window, new Event('resize'));
		view.rerender(
			<FittedHeaderTitle>Eine neue Überschrift</FittedHeaderTitle>
		);
		expect(
			screen.getByRole('heading', { name: 'Eine neue Überschrift' })
		).toBeTruthy();
		view.unmount();
	});

	it('observes both elements and disconnects when ResizeObserver is available', () => {
		const observe = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe = observe;
				disconnect = disconnect;
			}
		);
		const view = render(<FittedHeaderTitle>Beratung</FittedHeaderTitle>);
		expect(observe).toHaveBeenCalledTimes(2);
		view.unmount();
		expect(disconnect).toHaveBeenCalledOnce();
	});
});
