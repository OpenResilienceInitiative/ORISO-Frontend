// @vitest-environment jsdom
import * as React from 'react';
import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useImagePreviewUrl } from './useImagePreviewUrl';

const Thumb = ({ file }: { file: File | null }) => {
	const url = useImagePreviewUrl(file);
	return url ? (
		<img data-testid="thumb" src={url} alt="preview" />
	) : (
		<span data-testid="no-thumb" />
	);
};

describe('useImagePreviewUrl', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('keeps the shown object URL alive under StrictMode double-mount', () => {
		const revoked = new Set<string>();
		let counter = 0;
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => `blob:mock-${(counter += 1)}`),
			revokeObjectURL: vi.fn((url: string) => revoked.add(url))
		});

		const file = new File(['x'], 'photo.png', { type: 'image/png' });
		render(
			<StrictMode>
				<Thumb file={file} />
			</StrictMode>
		);

		const shownUrl = screen
			.getByTestId('thumb')
			.getAttribute('src') as string;
		// The URL the <img> currently shows must NOT have been revoked — the
		// old useMemo pattern revoked it on the StrictMode cleanup and left a
		// broken thumbnail (the 1146 KB paste regression).
		expect(revoked.has(shownUrl)).toBe(false);
	});

	it('renders nothing for non-image files', () => {
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:should-not-be-called'),
			revokeObjectURL: vi.fn()
		});
		render(
			<Thumb
				file={new File(['x'], 'a.pdf', { type: 'application/pdf' })}
			/>
		);
		expect(screen.queryByTestId('thumb')).toBeNull();
		expect(URL.createObjectURL).not.toHaveBeenCalled();
	});
});
