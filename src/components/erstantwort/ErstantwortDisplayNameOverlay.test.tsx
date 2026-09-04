// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPatchUserData = vi.hoisted(() => vi.fn());
const regeneratePseudonym = vi.hoisted(() =>
	vi.fn(() => ({
		displayName: 'Ruhiges Yak Kim',
		avatar: { file: 'yak.svg', bg: '#fff', iconColor: '#000' },
		animalLabel: 'Yak',
		name: 'Kim'
	}))
);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: (...args: unknown[]) => apiPatchUserData(...args)
}));

vi.mock('../../utils/pseudonymGenerator', () => ({
	regeneratePseudonym: (...args: unknown[]) => regeneratePseudonym(...args)
}));

vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' },
	Overlay: ({ item, handleOverlay }: any) => (
		<div>
			<h2>{item.headline}</h2>
			{item.copy && <p>{item.copy}</p>}
			{item.nestedComponent}
			{item.buttonSet?.map((button: any) => (
				<button
					key={button.label}
					disabled={button.disabled}
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</div>
	)
}));

/* eslint-disable-next-line import/first -- component import must follow vi.mock */
import { ErstantwortDisplayNameOverlay } from './ErstantwortDisplayNameOverlay';

afterEach(cleanup);
beforeEach(() => {
	apiPatchUserData.mockReset();
	apiPatchUserData.mockResolvedValue(undefined);
	regeneratePseudonym.mockClear();
});

describe('ErstantwortDisplayNameOverlay', () => {
	it('shows the current name and re-rolls it with the dice', () => {
		render(
			<ErstantwortDisplayNameOverlay
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={vi.fn()}
				onSaved={vi.fn()}
			/>
		);

		expect(screen.getByText('Sanftes Alpaka Kala')).toBeTruthy();

		act(() => {
			screen.getByRole('button', { name: 'Namen neu würfeln' }).click();
		});

		expect(regeneratePseudonym).toHaveBeenCalled();
		expect(screen.getByText('Ruhiges Yak Kim')).toBeTruthy();
	});

	it('saves the rolled name via apiPatchUserData', async () => {
		const onSaved = vi.fn();
		render(
			<ErstantwortDisplayNameOverlay
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={vi.fn()}
				onSaved={onSaved}
			/>
		);

		act(() => {
			screen.getByRole('button', { name: 'Namen neu würfeln' }).click();
		});
		act(() => {
			screen.getByRole('button', { name: 'Übernehmen' }).click();
		});

		await waitFor(() =>
			expect(apiPatchUserData).toHaveBeenCalledWith({
				displayName: 'Ruhiges Yak Kim'
			})
		);
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
	});

	it('closes without saving', () => {
		const onClose = vi.fn();
		render(
			<ErstantwortDisplayNameOverlay
				currentName="Sanftes Alpaka Kala"
				locale="de"
				onClose={onClose}
				onSaved={vi.fn()}
			/>
		);

		act(() => {
			screen.getByRole('button', { name: 'Close' }).click();
		});

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});
});
