// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { RELOAD_FALLBACK_MS } from '../../utils/chunkLoadRecovery';

const mockRedirectToErrorPage = vi.fn();
const mockApiPostError = vi.fn(() => Promise.resolve());
const mockReloadOnceForNewBuild = vi.fn();
const mockReportChunkLoadGaveUp = vi.fn();

vi.mock('../error/errorHandling', () => ({
	redirectToErrorPage: (...args: unknown[]) =>
		mockRedirectToErrorPage(...args)
}));
vi.mock('../../api/apiPostError', () => ({
	ERROR_LEVEL_FATAL: 'FATAL',
	apiPostError: (...args: unknown[]) => mockApiPostError(...args)
}));
vi.mock('../devToolbar/DevToolbar', () => ({
	STORAGE_KEY_ERROR_BOUNDARY: 'error_boundary'
}));
vi.mock('./Loading', () => ({ Loading: () => <div>loading</div> }));
vi.mock('../../utils/chunkLoadRecovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../utils/chunkLoadRecovery')>()),
	reloadOnceForNewBuild: () => mockReloadOnceForNewBuild(),
	reportChunkLoadGaveUp: () => mockReportChunkLoadGaveUp()
}));

const Throws = ({ error }: { error: Error }) => {
	throw error;
};

const chunkError = () => {
	const error = new Error(
		'Loading chunk 265 failed.\n(error: https://dev.example.org/static/js/265.858f3919.chunk.js)'
	);
	error.name = 'ChunkLoadError';
	return error;
};

describe('ErrorBoundary', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		window.localStorage.clear();
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('reloads instead of showing error.500.html when the tab still runs the previous build', async () => {
		mockReloadOnceForNewBuild.mockReturnValue(true);

		render(
			<ErrorBoundary>
				<Throws error={chunkError()} />
			</ErrorBoundary>
		);
		await Promise.resolve();

		expect(mockReloadOnceForNewBuild).toHaveBeenCalledTimes(1);
		expect(mockRedirectToErrorPage).not.toHaveBeenCalled();
		expect(mockApiPostError).not.toHaveBeenCalled();
	});

	it('shows the error page after all when the browser swallowed the reload', async () => {
		vi.useFakeTimers();
		mockReloadOnceForNewBuild.mockReturnValue(true);

		render(
			<ErrorBoundary>
				<Throws error={chunkError()} />
			</ErrorBoundary>
		);
		expect(mockRedirectToErrorPage).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(RELOAD_FALLBACK_MS);

		expect(mockReportChunkLoadGaveUp).toHaveBeenCalledTimes(1);
		expect(mockRedirectToErrorPage).toHaveBeenCalledWith(500);
		vi.useRealTimers();
	});

	it('still shows the error page when a reload did not help', async () => {
		mockReloadOnceForNewBuild.mockReturnValue(false);

		render(
			<ErrorBoundary>
				<Throws error={chunkError()} />
			</ErrorBoundary>
		);

		await vi.waitFor(() =>
			expect(mockRedirectToErrorPage).toHaveBeenCalledWith(500)
		);
		expect(mockReportChunkLoadGaveUp).toHaveBeenCalledTimes(1);
		expect(mockApiPostError).toHaveBeenCalledTimes(1);
	});

	it('never reloads for an ordinary render error', async () => {
		render(
			<ErrorBoundary>
				<Throws error={new TypeError('x is not a function')} />
			</ErrorBoundary>
		);

		await vi.waitFor(() =>
			expect(mockRedirectToErrorPage).toHaveBeenCalledWith(500)
		);
		expect(mockReloadOnceForNewBuild).not.toHaveBeenCalled();
		expect(mockReportChunkLoadGaveUp).not.toHaveBeenCalled();
	});
});
