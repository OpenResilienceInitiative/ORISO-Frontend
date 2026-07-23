// @vitest-environment jsdom

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AgencySpecificContext, LocaleContext } from '../../globalState';
import { StageLayout } from './StageLayout';

vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		urls: {
			toLogin: 'https://app.oriso-dev.site/login',
			toRegistration: 'https://app.oriso-dev.site/registration'
		}
	})
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'login.register.linkLabel' ? 'Register' : key
	})
}));

vi.mock('../registration/infoDrawer/InfoDrawer', () => ({
	InfoDrawer: () => null
}));

vi.mock('lottie-react', () => ({ default: () => null }));

describe('StageLayout registration invitation continuity', () => {
	it('uses the invitation-aware registration URL supplied by Login', () => {
		render(
			<MemoryRouter>
				<LocaleContext.Provider
					value={{ selectableLocales: [] } as any}
				>
					<AgencySpecificContext.Provider
						value={{ specificAgency: null } as any}
					>
						<StageLayout
							stage={<div>stage</div>}
							showRegistrationLink
							registrationUrl="https://app.oriso-dev.site/registration?gcid=1017"
						>
							<div>content</div>
						</StageLayout>
					</AgencySpecificContext.Provider>
				</LocaleContext.Provider>
			</MemoryRouter>
		);

		expect(
			screen.getByRole('link', { name: /register/i }).getAttribute('href')
		).toBe('https://app.oriso-dev.site/registration?gcid=1017');
	});
});
