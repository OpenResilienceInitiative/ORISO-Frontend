// @vitest-environment jsdom
/**
 * #1377 slice 6 — Profile › Display filters: edits the per-section DEFAULTS
 * (never a list override), the per-event-type list, and the limited
 * "apply to other lists" action (spec §4).
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { DisplayFilterProfileSection } from './DisplayFilterProfileSection';
import { displayFilterStore } from '../../../utils/displayFilter/store';
import {
	DEFAULT_DISPLAY_FILTERS,
	withSectionOverride
} from '../../../utils/displayFilter/model';
import { UserDataContext } from '../../../globalState/context/UserDataContext';
import { AUTHORITIES } from '../../../globalState/helpers/stateHelpers';
import { apiGetAgenciesByIds } from '../../../api/apiGetAgenciesByIds';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) =>
			opts && 'type' in opts
				? `${key}:${opts.type}`
				: opts && 'kind' in opts
					? `${key}:${opts.kind}`
					: key
	})
}));
vi.mock('../../headline/Headline', () => ({
	Headline: ({ text }: { text: string }) => <h5>{text}</h5>
}));
vi.mock('../../text/Text', () => ({
	Text: ({ text }: { text: string }) => <p>{text}</p>
}));
vi.mock('../../../globalState/provider/TenantProvider', () => ({
	useTenant: () => ({
		settings: {
			featureGroupChatV2Enabled: true,
			featureSupervisionEnabled: true
		}
	})
}));

// The counsellor's Beratungsstellen and their effective settings (#1440).
vi.mock('../../../api/apiGetAgenciesByIds', () => ({
	apiGetAgenciesByIds: vi.fn().mockResolvedValue([])
}));

const consultant = {
	userId: 'c1',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
} as any;

let stored: any;
const attach = (initial: any) => {
	stored = initial;
	displayFilterStore.attachClient({
		getUserId: () => '@c1:hs',
		getSyncState: () => 'PREPARED',
		getAccountData: () => ({ getContent: () => stored }),
		setAccountData: vi.fn(async (_type: string, content: any) => {
			stored = content;
		}),
		on: () => undefined,
		removeListener: () => undefined
	} as any);
};

const renderSection = (userData: any = consultant) =>
	render(
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: () => undefined,
				reloadUserData: async () => null as any
			}}
		>
			<DisplayFilterProfileSection />
		</UserDataContext.Provider>
	);

const checkbox = (cy: string): HTMLInputElement => {
	const element = document.querySelector(`[data-cy="${cy}"]`);
	return (
		element?.tagName === 'INPUT' ? element : element?.querySelector('input')
	) as HTMLInputElement;
};

describe('DisplayFilterProfileSection', () => {
	beforeEach(() => {
		displayFilterStore.resetForTests();
		localStorage.clear();
	});
	afterEach(() => {
		cleanup();
		displayFilterStore.resetForTests();
	});

	it('renders the three sections with their kinds and no auto-read for Anfragen', () => {
		attach(DEFAULT_DISPLAY_FILTERS);
		renderSection();
		expect(
			checkbox('display-filter-profile-timeline-show-system')
		).not.toBeNull();
		expect(
			checkbox('display-filter-profile-sessions-show-supervision')
		).not.toBeNull();
		expect(
			checkbox('display-filter-profile-sessions-show-circle')
		).not.toBeNull();
		expect(
			checkbox('display-filter-profile-requests-show-liveChat')
		).not.toBeNull();
		expect(
			document.querySelector(
				'[data-cy="display-filter-profile-timeline-autoread"]'
			)
		).not.toBeNull();
		expect(
			document.querySelector(
				'[data-cy="display-filter-profile-requests-autoread"]'
			)
		).toBeNull();
	});

	it('writes the section DEFAULT, leaving an existing list override untouched', () => {
		attach(
			withSectionOverride(DEFAULT_DISPLAY_FILTERS, 'sessions', {
				kinds: { liveChat: { show: false, pill: false } },
				autoReadHidden: false
			})
		);
		renderSection();
		expect(
			screen.getAllByText('notifications.displayFilter.overrideActive')
		).toHaveLength(1);
		act(() => {
			fireEvent.click(
				checkbox('display-filter-profile-sessions-show-circle')
			);
		});
		const { filters } = displayFilterStore.getState();
		// The pill preference survives hiding (masked on read by
		// resolveKindSetting), so hide → show is a round trip.
		expect(filters.global.sessions.kinds.circle).toEqual({
			show: false,
			pill: true
		});
		expect(filters.sections.sessions).toEqual({
			kinds: { liveChat: { show: false, pill: false } },
			autoReadHidden: false
		});
	});

	it('per-event-type: unticking a type adds it to hiddenEventTypes and marks the family partial', () => {
		attach(DEFAULT_DISPLAY_FILTERS);
		renderSection();
		act(() => {
			fireEvent.click(
				checkbox('display-filter-event-type-supervisor.added')
			);
		});
		const { filters } = displayFilterStore.getState();
		expect(filters.global.timeline.hiddenEventTypes).toEqual([
			'supervisor.added'
		]);
		expect(
			checkbox(
				'display-filter-profile-timeline-show-system'
			).getAttribute('aria-checked')
		).toBe('mixed');
		act(() => {
			fireEvent.click(
				checkbox('display-filter-event-type-supervisor.added')
			);
		});
		expect(
			displayFilterStore.getState().filters.global.timeline
				.hiddenEventTypes
		).toEqual([]);
	});

	it('"apply to other lists" copies only auto-read and the live-chat kind (§4)', () => {
		attach(DEFAULT_DISPLAY_FILTERS);
		renderSection();
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-cy="display-filter-profile-sessions-autoread"]'
				) as HTMLInputElement
			);
			fireEvent.click(
				checkbox('display-filter-profile-sessions-show-liveChat')
			);
			fireEvent.click(
				checkbox('display-filter-profile-sessions-show-circle')
			);
		});
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-cy="display-filter-profile-sessions-apply-all"]'
				) as HTMLButtonElement
			);
		});
		const { global } = displayFilterStore.getState().filters;
		expect(global.timeline.autoReadHidden).toBe(true);
		expect(global.requests.autoReadHidden).toBe(false);
		expect(global.requests.kinds.liveChat).toEqual({
			show: false,
			pill: true
		});
		expect(global.requests.kinds.circle).toBeUndefined();
		expect(global.timeline.kinds.liveChat).toBeUndefined();
	});

	it('"apply to other lists" with a default live-chat setting resets a customised target', () => {
		attach({
			...DEFAULT_DISPLAY_FILTERS,
			global: {
				...DEFAULT_DISPLAY_FILTERS.global,
				requests: {
					kinds: { liveChat: { show: false, pill: false } },
					autoReadHidden: false
				}
			}
		});
		renderSection();
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-cy="display-filter-profile-sessions-apply-all"]'
				) as HTMLButtonElement
			);
		});
		const { global } = displayFilterStore.getState().filters;
		expect(global.requests.kinds.liveChat).toBeUndefined();
	});

	it('is inert before the store is synced', () => {
		displayFilterStore.attachClient({
			getUserId: () => '@c1:hs',
			getSyncState: () => null,
			getAccountData: () => undefined,
			setAccountData: vi.fn(),
			on: () => undefined,
			removeListener: () => undefined
		} as any);
		renderSection();
		expect(
			checkbox('display-filter-profile-timeline-show-system').disabled
		).toBe(true);
	});

	// #1440: the circle and internal-chat kinds follow what the Träger AND at
	// least one of the counsellor's Beratungsstellen allow, like the create
	// entry does.
	it('hides the circle kinds when the counsellor’s Beratungsstelle switched circles off', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValueOnce([
			{
				id: 7,
				name: 'Agency Seven',
				settings: {
					featureGroupChatV2Enabled: true,
					featureInternalGroupChatEnabled: true,
					featureSelfHelpGroupsEnabled: false
				}
			} as any
		]);
		attach(DEFAULT_DISPLAY_FILTERS);
		renderSection({
			...consultant,
			agencies: [{ id: 7, name: 'Agency Seven' }]
		});

		await waitFor(() =>
			expect(
				checkbox('display-filter-profile-sessions-show-circle')
			).toBeFalsy()
		);
		expect(
			checkbox('display-filter-profile-sessions-show-futureTimeline')
		).toBeFalsy();
		expect(
			checkbox('display-filter-profile-sessions-show-internalGroup')
		).toBeTruthy();
		expect(apiGetAgenciesByIds).toHaveBeenCalledWith([7]);
	});

	it('hides both kinds when the Beratungsstelle’s master switch is off', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValueOnce([
			{
				id: 7,
				name: 'Agency Seven',
				settings: {
					featureGroupChatV2Enabled: false,
					featureInternalGroupChatEnabled: true,
					featureSelfHelpGroupsEnabled: true
				}
			} as any
		]);
		attach(DEFAULT_DISPLAY_FILTERS);
		renderSection({
			...consultant,
			agencies: [{ id: 7, name: 'Agency Seven' }]
		});

		await waitFor(() =>
			expect(
				checkbox('display-filter-profile-sessions-show-internalGroup')
			).toBeFalsy()
		);
		expect(
			checkbox('display-filter-profile-sessions-show-circle')
		).toBeFalsy();
	});
});
