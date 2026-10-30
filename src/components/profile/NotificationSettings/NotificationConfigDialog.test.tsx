// @vitest-environment oriso-jsdom
/**
 * #576 — Figma "Configure your notifications" dialog body: three area tabs
 * (Termine disabled), per-kind sound dropdown + send-by-email, tab switching.
 */
import * as React from 'react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
	NotificationConfigDialog,
	NotificationConfigView
} from './NotificationConfigDialog';
import { DEFAULT_NOTIFICATION_CONFIG } from '../../../utils/notificationSettings/notificationConfig';

// The component tags nodes with data-cy (Cypress convention); make getByTestId use it.
configure({ testIdAttribute: 'data-cy' });

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown> | string) =>
			opts && typeof opts === 'object' && 'number' in opts
				? `${key}:${opts.number}`
				: key
	})
}));

// vitest has no svgr plugin — stub the icon ReactComponent exports.
vi.mock('../../../resources/img/icons/notification_settings.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/notification_audio_off.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/play-circle.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/keyboard_arrow_up.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/keyboard_arrow_down.svg', () => ({
	ReactComponent: () => null
}));

// Test seam: lets a spec make a row "not yet available" or a whole tab empty.
type Availability =
	import('../../../utils/notificationSettings/notificationChannelCapability').RowAvailability;
let availabilityOverride:
	| ((area: string, kind: string) => Availability | undefined)
	| null = null;
vi.mock(
	'../../../utils/notificationSettings/notificationChannelCapability',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../../utils/notificationSettings/notificationChannelCapability')
			>();
		const rowAvailability: typeof actual.rowAvailability = (
			role,
			area,
			kind,
			cases
		) =>
			availabilityOverride?.(area, kind) ??
			actual.rowAvailability(role, area, kind, cases);
		return {
			...actual,
			rowAvailability,
			visibleAreas: (role, areas, kindsOf) =>
				areas.filter((area) =>
					kindsOf(area).some(
						(kind) =>
							rowAvailability(role, area, kind).visibility !==
							'hidden'
					)
				)
		};
	}
);

// The email link is a router Link.
const baseProps = {
	role: 'consultant' as const,
	config: DEFAULT_NOTIFICATION_CONFIG,
	activeArea: 'requests' as const,
	onAreaChange: vi.fn(),
	onChange: vi.fn(),
	onPreview: vi.fn()
};

const EmailDestination = () => {
	const location = useLocation();
	return <div>email destination {location.hash}</div>;
};

describe('NotificationConfigDialog', () => {
	afterEach(cleanup);

	it('keeps the actions outside the keyboard-scrollable dialog body', () => {
		const onConfirm = vi.fn();
		const { baseElement } = render(
			<MemoryRouter>
				<NotificationConfigDialog
					role="consultant"
					open
					config={DEFAULT_NOTIFICATION_CONFIG}
					onConfirm={onConfirm}
					onClose={vi.fn()}
				/>
			</MemoryRouter>
		);

		const surface = baseElement.querySelector('.m3Dialog__surface');
		const body = surface?.querySelector('.m3Dialog__body');
		const footer = surface?.querySelector('.m3Dialog__footer');

		expect(surface).toBeTruthy();
		expect(body?.getAttribute('tabindex')).toBe('0');
		expect(body?.querySelector('[data-cy="notif-config"]')).toBeTruthy();
		expect(footer).toBeTruthy();
		expect(body?.contains(footer ?? null)).toBe(false);

		fireEvent.change(screen.getByTestId('notif-banner-requests-new'), {
			target: { value: 'persistent' }
		});
		fireEvent.click(
			surface?.querySelector(
				'[data-testid="notif-confirm"]'
			) as HTMLElement
		);
		expect(onConfirm).toHaveBeenCalledWith({
			...DEFAULT_NOTIFICATION_CONFIG,
			requests: {
				...DEFAULT_NOTIFICATION_CONFIG.requests,
				new: {
					...DEFAULT_NOTIFICATION_CONFIG.requests.new,
					banner: 'persistent'
				}
			}
		});
	});

	it('keeps an edited draft when email navigation is cancelled, then discards only on confirmation', () => {
		const onClose = vi.fn();
		const onConfirm = vi.fn();
		render(
			<MemoryRouter initialEntries={['/profile/notifications/browser']}>
				<Routes>
					<Route
						path="/profile/notifications/browser"
						element={
							<NotificationConfigDialog
								role="consultant"
								open
								config={DEFAULT_NOTIFICATION_CONFIG}
								onConfirm={onConfirm}
								onClose={onClose}
							/>
						}
					/>
					<Route
						path="/profile/einstellungen/email"
						element={<EmailDestination />}
					/>
				</Routes>
			</MemoryRouter>
		);

		fireEvent.change(screen.getByTestId('notif-banner-requests-new'), {
			target: { value: 'persistent' }
		});
		const emailLink = screen.getByRole('link', {
			name: 'profile.notifications.title'
		});
		fireEvent.click(emailLink);
		expect(
			screen.getByText(
				'profile.notifications.config.discardChanges.title'
			)
		).toBeTruthy();
		expect(screen.queryByText(/email destination/)).toBeNull();
		fireEvent.click(
			document.querySelector(
				'[data-testid="notif-keep-editing"]'
			) as HTMLElement
		);
		expect(
			(
				screen.getByTestId(
					'notif-banner-requests-new'
				) as HTMLSelectElement
			).value
		).toBe('persistent');
		expect(onClose).not.toHaveBeenCalled();

		fireEvent.click(emailLink);
		fireEvent.click(
			document.querySelector(
				'[data-testid="notif-discard-changes"]'
			) as HTMLElement
		);
		expect(
			screen.getByText('email destination #email-notifications')
		).toBeTruthy();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('navigates directly to email preferences when the draft is clean', () => {
		const onClose = vi.fn();
		render(
			<MemoryRouter initialEntries={['/profile/notifications/browser']}>
				<Routes>
					<Route
						path="/profile/notifications/browser"
						element={
							<NotificationConfigDialog
								role="consultant"
								open
								config={DEFAULT_NOTIFICATION_CONFIG}
								onConfirm={vi.fn()}
								onClose={onClose}
							/>
						}
					/>
					<Route
						path="/profile/einstellungen/email"
						element={<EmailDestination />}
					/>
				</Routes>
			</MemoryRouter>
		);

		fireEvent.click(
			screen.getByRole('link', {
				name: 'profile.notifications.title'
			})
		);
		expect(
			screen.getByText('email destination #email-notifications')
		).toBeTruthy();
		expect(
			screen.queryByText(
				'profile.notifications.config.discardChanges.title'
			)
		).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it.each([true, false])('email link shown=%s', (showEmailLink) => {
		render(
			<MemoryRouter>
				<NotificationConfigDialog
					role="consultant"
					open
					config={DEFAULT_NOTIFICATION_CONFIG}
					onConfirm={vi.fn()}
					onClose={vi.fn()}
					showEmailLink={showEmailLink}
				/>
			</MemoryRouter>
		);
		expect(
			!!screen.queryByRole('link', {
				name: 'profile.notifications.title'
			})
		).toBe(showEmailLink);
	});
});

describe('NotificationConfigView', () => {
	afterEach(() => {
		cleanup();
		availabilityOverride = null;
	});

	it('renders the three harmonised area tabs, all enabled', () => {
		render(<NotificationConfigView {...baseProps} />);
		for (const tab of [
			'notif-tab-requests',
			'notif-tab-conversations',
			'notif-tab-timeCritical'
		]) {
			expect(
				(screen.getByTestId(tab) as HTMLButtonElement).disabled
			).toBe(false);
		}
	});

	it('conversations tab shows the handover row; time-critical shows call+appointment and the wecker card', () => {
		const { rerender } = render(
			<NotificationConfigView {...baseProps} activeArea="conversations" />
		);
		expect(
			screen.getByTestId('notif-row-conversations-handover')
		).toBeTruthy();
		rerender(
			<NotificationConfigView {...baseProps} activeArea="timeCritical" />
		);
		expect(screen.getByTestId('notif-row-timeCritical-call')).toBeTruthy();
		expect(
			screen.getByTestId('notif-row-timeCritical-appointment')
		).toBeTruthy();
		expect(screen.getByTestId('notif-wecker-card')).toBeTruthy();
		// voting is a dummy: any vote flips to the thanks note
		fireEvent.click(screen.getByTestId('notif-wecker-up'));
		expect(screen.getByTestId('notif-wecker-thanks')).toBeTruthy();
	});

	it('reports a banner mode change (off / temporary / persistent)', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('notif-banner-requests-new'), {
			target: { value: 'persistent' }
		});
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'banner',
			'persistent'
		);
	});

	it('renders the three kind rows for the active area while the role is unknown', () => {
		render(<NotificationConfigView {...baseProps} role={undefined} />);
		expect(screen.getByTestId('notif-row-requests-new')).toBeTruthy();
		expect(screen.getByTestId('notif-row-requests-standard')).toBeTruthy();
		expect(screen.getByTestId('notif-row-requests-mention')).toBeTruthy();
	});

	it('reports a sound change with the chosen tone', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		const select = screen
			.getByTestId('notif-row-requests-new')
			.querySelector('select') as HTMLSelectElement;
		fireEvent.change(select, { target: { value: 'ton-3' } });
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'sound',
			'ton-3'
		);
	});

	it('links to authoritative email preferences instead of editing Matrix email flags', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		expect(screen.queryByTestId('notif-email-requests-mention')).toBeNull();
		expect(
			screen.queryByText('profile.notifications.config.emailNote')
		).toBeNull();
		expect(
			screen
				.getByRole('link', { name: 'profile.notifications.title' })
				.getAttribute('href')
		).toBe('/profile/einstellungen/email#email-notifications');
		expect(onChange).not.toHaveBeenCalled();
	});

	it('switches area via a tab click', () => {
		const onAreaChange = vi.fn();
		render(
			<NotificationConfigView
				{...baseProps}
				onAreaChange={onAreaChange}
			/>
		);
		fireEvent.click(screen.getByTestId('notif-tab-conversations'));
		expect(onAreaChange).toHaveBeenCalledWith('conversations');
	});

	it('offers Sound #1..#12 plus No Sound plus the ring tone', () => {
		render(<NotificationConfigView {...baseProps} />);
		const select = screen
			.getByTestId('notif-row-requests-new')
			.querySelector('select') as HTMLSelectElement;
		// "no sound" + ring + 12 tones
		expect(select.options.length).toBe(14);
		expect(select.options[0].value).toBe('none');
		expect(select.options[1].value).toBe('ring');
		expect(select.options[2].value).toBe('ton-1');
	});

	it('shows the muted icon and no play button when no sound is chosen', () => {
		// "Standard" stays silent by default ("Neue Anfrage" rings, FE#1435).
		render(<NotificationConfigView {...baseProps} role={undefined} />);
		expect(
			screen.queryByTestId('notif-muted-requests-standard')
		).toBeTruthy();
		expect(screen.queryByTestId('notif-play-requests-standard')).toBeNull();
		expect(screen.queryByTestId('notif-play-requests-new')).toBeTruthy();
	});

	it('shows a play button (not the muted icon) when a tone is chosen, and previews at volume', () => {
		const onPreview = vi.fn();
		const config = {
			...DEFAULT_NOTIFICATION_CONFIG,
			requests: {
				...DEFAULT_NOTIFICATION_CONFIG.requests,
				new: { sound: 'ton-5', email: true, volume: 0.75 }
			}
		};
		render(
			<NotificationConfigView
				{...baseProps}
				config={config as never}
				onPreview={onPreview}
			/>
		);
		expect(screen.queryByTestId('notif-muted-requests-new')).toBeNull();
		fireEvent.click(screen.getByTestId('notif-play-requests-new'));
		expect(onPreview).toHaveBeenCalledWith('ton-5', 0.75);
	});

	it('volume arrows change the volume', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('notif-volume-up-requests-new'));
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'volume',
			0.75
		);
		fireEvent.click(screen.getByTestId('notif-volume-down-requests-new'));
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'volume',
			0.25
		);
	});
});

describe('Live-Chat row (FE#1470)', () => {
	afterEach(cleanup);

	it('shows counsellors the Live-Chat row in Gespräche, with its tone preselected', () => {
		render(
			<MemoryRouter>
				<NotificationConfigView
					{...baseProps}
					activeArea="conversations"
				/>
			</MemoryRouter>
		);
		expect(
			screen.getByTestId('notif-row-conversations-liveChat')
		).toBeTruthy();
		// The play button only shows while a tone is chosen.
		expect(
			screen.getByTestId('notif-play-conversations-liveChat')
		).toBeTruthy();
		expect(
			screen.queryByTestId('notif-play-conversations-standard')
		).toBeNull();
	});

	it('hides the row from everyone else, where it could never fire', () => {
		render(
			<MemoryRouter>
				<NotificationConfigView
					{...baseProps}
					role="asker"
					activeArea="conversations"
				/>
			</MemoryRouter>
		);
		expect(
			screen.queryByTestId('notif-row-conversations-liveChat')
		).toBeNull();
		expect(
			screen.getByTestId('notif-row-conversations-standard')
		).toBeTruthy();
	});
});

describe('Rows that never fire are hidden, rows without a producer yet are disabled (epic #778)', () => {
	afterEach(() => {
		cleanup();
		availabilityOverride = null;
	});

	const renderRows = (
		role: 'consultant' | 'asker' | undefined,
		activeArea: 'requests' | 'conversations' | 'timeCritical'
	) =>
		render(
			<MemoryRouter>
				<NotificationConfigView
					{...baseProps}
					role={role}
					activeArea={activeArea}
				/>
			</MemoryRouter>
		);
	const rowIds = () =>
		Array.from(document.querySelectorAll('[data-cy^="notif-row-"]')).map(
			(el) => el.getAttribute('data-cy')
		);

	it('shows a counsellor only the Anfragen row that can fire for them', () => {
		renderRows('consultant', 'requests');
		expect(rowIds()).toEqual(['notif-row-requests-new']);
		expect(
			(
				screen.getByTestId(
					'notif-banner-requests-new'
				) as HTMLSelectElement
			).disabled
		).toBe(false);
	});

	it('shows an advice seeker only Standard in Anfragen, and no mention, new-request or live-chat rows', () => {
		renderRows('asker', 'requests');
		expect(rowIds()).toEqual(['notif-row-requests-standard']);
		cleanup();
		renderRows('asker', 'conversations');
		expect(rowIds()).toEqual([
			'notif-row-conversations-standard',
			'notif-row-conversations-handover'
		]);
	});

	it('shows the neutral, fully live dialog while the user data is still loading', () => {
		renderRows(undefined, 'requests');
		expect(rowIds()).toEqual([
			'notif-row-requests-new',
			'notif-row-requests-standard',
			'notif-row-requests-mention'
		]);
		for (const select of document.querySelectorAll('select')) {
			expect(select.disabled).toBe(false);
		}
		expect(document.querySelector('.notifConfig__reason')).toBeNull();
		cleanup();
		renderRows(undefined, 'conversations');
		expect(
			screen.queryByTestId('notif-row-conversations-liveChat')
		).toBeNull();
	});

	describe('a row whose event has no producer yet', () => {
		const notYet: Availability = {
			visibility: 'disabled',
			bannerEnabled: false,
			soundEnabled: false,
			reasonKey: 'profile.notifications.config.unavailable.notSentYet'
		};
		beforeEach(() => {
			availabilityOverride = (area, kind) =>
				area === 'timeCritical' && kind === 'appointment'
					? notYet
					: undefined;
		});

		it('is disabled with a visible reason that the controls are described by', () => {
			renderRows('consultant', 'timeCritical');
			const banner = screen.getByTestId(
				'notif-banner-timeCritical-appointment'
			) as HTMLSelectElement;
			const tone = screen
				.getByTestId('notif-row-timeCritical-appointment')
				.querySelector(
					'select.notifConfig__select'
				) as HTMLSelectElement;
			const reason = screen.getByTestId(
				'notif-reason-timeCritical-appointment'
			);
			expect(reason.textContent).toBe(notYet.reasonKey);
			for (const control of [banner, tone]) {
				expect(control.disabled).toBe(true);
				// Natively disabled: no redundant aria-disabled.
				expect(control.hasAttribute('aria-disabled')).toBe(false);
				expect(control.getAttribute('aria-describedby')).toBe(
					reason.id
				);
			}
			// The call row beside it is untouched.
			expect(
				(
					screen.getByTestId(
						'notif-banner-timeCritical-call'
					) as HTMLSelectElement
				).disabled
			).toBe(false);
		});

		it('does not let the disabled row change its settings', () => {
			const onChange = vi.fn();
			render(
				<MemoryRouter>
					<NotificationConfigView
						{...baseProps}
						activeArea="timeCritical"
						onChange={onChange}
					/>
				</MemoryRouter>
			);
			fireEvent.click(
				screen.getByTestId('notif-volume-up-timeCritical-appointment')
			);
			expect(onChange).not.toHaveBeenCalled();
		});

		it('gives the reason a unique id when two dialogs show the same row', () => {
			render(
				<MemoryRouter>
					<NotificationConfigView
						{...baseProps}
						activeArea="timeCritical"
					/>
					<NotificationConfigView
						{...baseProps}
						activeArea="timeCritical"
					/>
				</MemoryRouter>
			);
			const ids = screen
				.getAllByTestId('notif-reason-timeCritical-appointment')
				.map((el) => el.id);
			expect(ids).toHaveLength(2);
			expect(new Set(ids).size).toBe(2);
			expect(document.querySelectorAll(`[id="${ids[0]}"]`)).toHaveLength(
				1
			);
		});
	});

	it('does not offer a tab whose rows are all hidden, and falls back to the first tab', () => {
		const hidden: Availability = {
			visibility: 'hidden',
			bannerEnabled: false,
			soundEnabled: false,
			reasonKey: null
		};
		availabilityOverride = (area) =>
			area === 'timeCritical' ? hidden : undefined;
		renderRows('consultant', 'timeCritical');
		expect(screen.queryByTestId('notif-tab-timeCritical')).toBeNull();
		expect(screen.getByTestId('notif-tab-requests')).toBeTruthy();
		expect(rowIds()).toEqual(['notif-row-requests-new']);
	});
});
