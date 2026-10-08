// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildIdentity } from './BuildIdentity';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(() => {
	cleanup();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe('BuildIdentity', () => {
	it.each(['stage', 'authenticated'] as const)(
		'retains the %s renderer and full identity across builds',
		(variant) => {
			vi.stubEnv('REACT_APP_PLATFORM_VERSION', 'v2.0.6');
			vi.stubEnv('REACT_APP_BUILD_COMMIT', 'a'.repeat(40));
			const { container, rerender } = render(
				<BuildIdentity variant={variant} />
			);
			expect(
				container.querySelector(
					variant === 'stage'
						? 'p.stageLayout__platformVersion'
						: 'div.app__platformVersion'
				)
			).not.toBeNull();
			expect(screen.getByTestId('build-identity').textContent).toBe(
				'v2.0.6 - aaaaaaa'
			);
			expect(
				screen
					.getByTestId('build-identity')
					.getAttribute('data-build-commit')
			).toBe('a'.repeat(40));
			vi.stubEnv('REACT_APP_BUILD_COMMIT', 'b'.repeat(40));
			rerender(<BuildIdentity variant={variant} />);
			expect(screen.getByTestId('build-identity').textContent).toBe(
				'v2.0.6 - bbbbbbb'
			);
			expect(
				screen
					.getByTestId('build-identity')
					.getAttribute('data-platform-version')
			).toBe('v2.0.6');
		}
	);

	it('displays unknown rather than inventing a commit for a local build', () => {
		vi.stubEnv('REACT_APP_PLATFORM_VERSION', 'v2.0.6');
		vi.stubEnv('REACT_APP_BUILD_COMMIT', 'invalid');
		render(<BuildIdentity variant="stage" />);
		expect(screen.getByTestId('build-identity').textContent).toBe(
			'v2.0.6 - unknown'
		);
		expect(
			screen
				.getByTestId('build-identity')
				.getAttribute('data-build-commit')
		).toBe('');
	});

	it('preserves absence of an unconfigured footer label', () => {
		vi.stubEnv('REACT_APP_PLATFORM_VERSION', '');
		vi.stubEnv('REACT_APP_BUILD_COMMIT', '');
		render(<BuildIdentity variant="authenticated" />);
		expect(screen.queryByTestId('build-identity')).toBeNull();
	});

	it('still shows the build when the release is missing', () => {
		vi.stubEnv('REACT_APP_PLATFORM_VERSION', '');
		vi.stubEnv('REACT_APP_BUILD_COMMIT', 'a'.repeat(40));
		render(<BuildIdentity variant="stage" />);
		expect(screen.getByTestId('build-identity').textContent).toBe(
			'aaaaaaa'
		);
		expect(
			screen
				.getByTestId('build-identity')
				.getAttribute('data-platform-version')
		).toBe('');
	});
});
