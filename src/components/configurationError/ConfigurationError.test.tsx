// @vitest-environment jsdom
/** ORISO-Helm#368 — a missing runtime URL stops the app with a named error. */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
	ConfigurationError,
	reportRuntimeConfigProblems
} from './ConfigurationError';

describe('ConfigurationError', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('names every missing or invalid key', () => {
		render(
			<ConfigurationError
				problems={[
					{ key: 'REACT_APP_API_URL', problem: 'missing' },
					{ key: 'REACT_APP_LIVEKIT_WS_URL', problem: 'invalid' }
				]}
			/>
		);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
			/configuration/i
		);
		const items = screen
			.getAllByRole('listitem')
			.map((li) => li.textContent);
		expect(items).toEqual([
			expect.stringContaining('REACT_APP_API_URL'),
			expect.stringContaining('REACT_APP_LIVEKIT_WS_URL')
		]);
		expect(items[0]).toMatch(/missing/i);
		expect(items[1]).toMatch(/invalid/i);
	});

	it('logs one console error per key', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});

		reportRuntimeConfigProblems([
			{ key: 'REACT_APP_API_URL', problem: 'missing' },
			{ key: 'REACT_APP_KEYCLOAK_REALM', problem: 'missing' }
		]);

		expect(error).toHaveBeenCalledTimes(2);
		expect(String(error.mock.calls[0][0])).toContain('REACT_APP_API_URL');
		expect(String(error.mock.calls[1][0])).toContain(
			'REACT_APP_KEYCLOAK_REALM'
		);
	});
});
