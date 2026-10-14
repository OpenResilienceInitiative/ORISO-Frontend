// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaseHandoverBulkBar } from './CaseHandoverBulkBar';
import { COMPOSER_BOTTOM_CLEARANCE_PROPERTY } from '../m3Snackbar/composerClearance';

const labels = {
	region: 'Selection',
	selected: '3 selected',
	continueLabel: 'Continue',
	cancel: 'Cancel',
	emptyHint: 'Select at least one case.'
};

const clearance = () =>
	document.documentElement.style.getPropertyValue(
		COMPOSER_BOTTOM_CLEARANCE_PROPERTY
	);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('CaseHandoverBulkBar — floating notices (FE#1725)', () => {
	it('lifts floating snackbars above the bar while it is shown, so Continue stays tappable', () => {
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 844
		});
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
			{
				top: 700,
				bottom: 800,
				left: 0,
				right: 390,
				width: 390,
				height: 100,
				x: 0,
				y: 700,
				toJSON: () => ({})
			} as DOMRect
		);

		const view = render(
			<CaseHandoverBulkBar
				count={3}
				labels={labels}
				onContinue={() => undefined}
				onCancel={() => undefined}
			/>
		);

		expect(clearance()).toBe('160px');

		view.unmount();
		expect(clearance()).toBe('');
	});
});
