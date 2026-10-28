// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useTenant } from '../../globalState';
import { useCounsellorAgencyFormats } from '../../hooks/useCounsellorAgencyFormats';
import {
	COUNSELLOR_START_PATH,
	MY_LINKS_SETTINGS_PATH,
	SETTINGS_OVERVIEW_PATH,
	useDirectLinksAllowed,
	useDirectLinksAvailability,
	useDirectLinksRedirect
} from './useDirectLinksAllowed';

vi.mock('../../globalState', () => ({ useTenant: vi.fn() }));
vi.mock('../../hooks/useCounsellorAgencyFormats', () => ({
	useCounsellorAgencyFormats: vi.fn()
}));

const off = {
	featureDirectInviteChatEnabled: false,
	featureDirectInviteAudioEnabled: false,
	featureDirectInviteVideoEnabled: false
};

const given = (
	tenantSettings: object,
	agencies: object[] = [],
	isLoading = false
) => {
	vi.mocked(useTenant).mockReturnValue({ settings: tenantSettings } as never);
	vi.mocked(useCounsellorAgencyFormats).mockReturnValue({
		agencies,
		isLoading
	} as never);
};

beforeEach(() => vi.clearAllMocks());

describe('useDirectLinksAllowed (#1894)', () => {
	it('hides the links when the Träger allows no medium', () => {
		given(off);
		expect(
			renderHook(() => useDirectLinksAllowed(true)).result.current
		).toBe(false);
	});

	it('shows them when at least one medium is allowed', () => {
		given({ ...off, featureDirectInviteAudioEnabled: true });
		expect(
			renderHook(() => useDirectLinksAllowed(true)).result.current
		).toBe(true);
	});

	it('treats unset flags as allowed, as the card does', () => {
		given({});
		expect(
			renderHook(() => useDirectLinksAllowed(true)).result.current
		).toBe(true);
	});

	it('hides them when every Beratungsstelle switched all media off', () => {
		given({}, [
			{ id: 1, settings: off },
			{ id: 2, settings: off }
		]);
		expect(
			renderHook(() => useDirectLinksAllowed(true)).result.current
		).toBe(false);
	});

	it('shows them when one Beratungsstelle still allows a medium', () => {
		given({}, [
			{ id: 1, settings: off },
			{ id: 2, settings: { featureDirectInviteChatEnabled: null } }
		]);
		expect(
			renderHook(() => useDirectLinksAllowed(true)).result.current
		).toBe(true);
	});

	it('is false for askers and fetches no agency settings', () => {
		given({});
		expect(
			renderHook(() => useDirectLinksAllowed(false)).result.current
		).toBe(false);
		expect(useCounsellorAgencyFormats).toHaveBeenCalledWith(false);
	});
});

describe('useDirectLinksAvailability', () => {
	it('is not ready while the agencies’ settings load', () => {
		given(off, [], true);
		expect(
			renderHook(() => useDirectLinksAvailability(true)).result.current
		).toEqual({ allowed: false, ready: false });
	});

	it('is ready once they are known', () => {
		given(off);
		expect(
			renderHook(() => useDirectLinksAvailability(true)).result.current
		).toEqual({ allowed: false, ready: true });
	});
});

const Probe = ({ path, to }: { path: string; to: string }) => {
	useDirectLinksRedirect(true, (pathname) => pathname.startsWith(path), to);
	return null;
};

/** Where the router ends up after the hook ran from `start`. */
const landing = async (start: string, path: string, to: string) => {
	let current = '';
	const Report = () => {
		current = useLocation().pathname;
		return null;
	};
	render(
		React.createElement(
			MemoryRouter,
			{ initialEntries: [start] },
			React.createElement(Probe, { path, to }),
			React.createElement(Report)
		)
	);
	await act(async () => undefined);
	return current;
};

describe('useDirectLinksRedirect', () => {
	it('sends /direct-links to the counsellor start page when no medium is allowed', async () => {
		given(off);
		expect(
			await landing(
				'/direct-links',
				'/direct-links',
				COUNSELLOR_START_PATH
			)
		).toBe(COUNSELLOR_START_PATH);
	});

	it('sends "Meine Links" to the Settings overview', async () => {
		given(off);
		expect(
			await landing(
				MY_LINKS_SETTINGS_PATH,
				MY_LINKS_SETTINGS_PATH,
				SETTINGS_OVERVIEW_PATH
			)
		).toBe(SETTINGS_OVERVIEW_PATH);
	});

	it('waits while the agencies’ settings load (no redirect flash)', async () => {
		given(off, [], true);
		expect(
			await landing(
				'/direct-links',
				'/direct-links',
				COUNSELLOR_START_PATH
			)
		).toBe('/direct-links');
	});

	it('stays when a medium is allowed', async () => {
		given({ ...off, featureDirectInviteChatEnabled: true });
		expect(
			await landing(
				'/direct-links',
				'/direct-links',
				COUNSELLOR_START_PATH
			)
		).toBe('/direct-links');
	});

	it('leaves other pages alone', async () => {
		given(off);
		expect(
			await landing(
				'/profile/einstellungen/sicherheit',
				MY_LINKS_SETTINGS_PATH,
				SETTINGS_OVERVIEW_PATH
			)
		).toBe('/profile/einstellungen/sicherheit');
	});
});
