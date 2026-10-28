// @vitest-environment oriso-jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useTenant } from '../../globalState';
import { useCounsellorAgencyFormats } from '../../hooks/useCounsellorAgencyFormats';
import { useDirectLinksAllowed } from './useDirectLinksAllowed';

vi.mock('../../globalState', () => ({ useTenant: vi.fn() }));
vi.mock('../../hooks/useCounsellorAgencyFormats', () => ({
	useCounsellorAgencyFormats: vi.fn()
}));

const off = {
	featureDirectInviteChatEnabled: false,
	featureDirectInviteAudioEnabled: false,
	featureDirectInviteVideoEnabled: false
};

const given = (tenantSettings: object, agencies: object[] = []) => {
	vi.mocked(useTenant).mockReturnValue({ settings: tenantSettings } as never);
	vi.mocked(useCounsellorAgencyFormats).mockReturnValue({
		agencies,
		isLoading: false
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
