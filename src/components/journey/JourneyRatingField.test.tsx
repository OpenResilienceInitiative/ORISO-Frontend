// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { JourneyRatingField } from './JourneyRatingField';
import { stars } from './journeyFixtures';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: { count?: number; max?: number }) =>
			values?.count !== undefined
				? `${values.count} von ${values.max}`
				: key
	})
}));

afterEach(cleanup);

describe('stars (#2333)', () => {
	it('a tap on a star answers with its count, and a tap on the chosen one confirms it', () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<JourneyRatingField
				rating={stars}
				language="de"
				onChange={onChange}
			/>
		);
		fireEvent.click(screen.getByRole('radio', { name: '4 von 5' }));
		expect(onChange).toHaveBeenLastCalledWith(4);
		rerender(
			<JourneyRatingField
				rating={stars}
				value={4}
				language="de"
				onChange={onChange}
			/>
		);
		expect(
			(screen.getByRole('radio', { name: '4 von 5' }) as HTMLInputElement)
				.checked
		).toBe(true);
	});
});
