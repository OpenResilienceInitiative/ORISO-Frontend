// @vitest-environment jsdom
import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigContext } from '../../globalState';
import { useDisplayFilterLabels } from './useDisplayFilterLabels';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const descriptionFor = (newNotifications: boolean) =>
	renderHook(() => useDisplayFilterLabels('timeline'), {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<AppConfigContext.Provider
				value={
					{
						releaseToggles: {
							enableNewNotifications: newNotifications
						}
					} as never
				}
			>
				{children}
			</AppConfigContext.Provider>
		)
	}).result.current.dialogLabels.description;

describe('useDisplayFilterLabels', () => {
	it('promises an e-mail choice only while the E-Mail column exists', () => {
		expect(descriptionFor(true)).toBe(
			'notifications.displayFilter.descriptions.timeline'
		);
		expect(descriptionFor(false)).toBe(
			'notifications.displayFilter.descriptions.timelineWithoutEmail'
		);
	});
});
