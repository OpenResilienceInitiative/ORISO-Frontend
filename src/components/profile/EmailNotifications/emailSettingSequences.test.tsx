// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AppConfigContext,
	NotificationsContext,
	UserDataContext
} from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import {
	DisplayFilterDialog,
	SESSION_COLUMNS
} from '../../displayFilter/DisplayFilterDialog';
import { EMPTY_DISPLAY_FILTER } from '../../displayFilter/displayFilterTypes';
import {
	SESSION_KINDS,
	STORY_LABELS
} from '../../displayFilter/displayFilterStoryData';
import { useDisplayFilterEmailColumn } from '../../displayFilter/useDisplayFilterEmailColumn';
import { EmailToggle } from './EmailToggle';
import { readEmailSetting } from './emailSetting';

vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn()
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../../utils/notificationSettings/soundPlayback', () => ({
	previewNotificationSound: vi.fn(),
	soundAssetFor: () => null
}));

/*
 * Every write sequence of length 2 and 3 to ONE setting, made faster than
 * the server answers: each PATCH and each reload succeeds or fails. When
 * everything has settled, the control must show what the server stores
 * (Codex reviews on FE#1752: stale rollback, stale reload, lost settle).
 */
type Step = { patch: boolean; reload: boolean };
const STEPS: Step[] = [
	{ patch: true, reload: true },
	{ patch: true, reload: false },
	{ patch: false, reload: true },
	{ patch: false, reload: false }
];
const sequences = (length: number): Step[][] =>
	length === 0
		? [[]]
		: sequences(length - 1).flatMap((rest) =>
				STEPS.map((step) => [...rest, step])
			);
const CASES = [...sequences(2), ...sequences(3)];
const label = (steps: Step[]) =>
	steps
		.map(
			(step) =>
				`${step.patch ? 'ok' : 'fail'}/${step.reload ? 'ok' : 'fail'}`
		)
		.join(' → ');

const initialUserData = () => ({
	email: 'counsellor@example.test',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	emailNotifications: {
		emailNotificationsEnabled: true,
		settings: {
			initialEnquiryNotificationEnabled: true,
			appointmentNotificationEnabled: true
		}
	},
	emailToggles: [
		{ name: 'DAILY_ENQUIRY', state: true },
		{ name: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER', state: true }
	]
});

/** A fake server: PATCH replaces fields whole, reload returns a copy. */
const serve = (steps: Step[]) => {
	const server = { data: initialUserData(), patches: 0, reloads: 0 };
	vi.mocked(apiPatchUserData).mockImplementation(async (patch) => {
		const step = steps[server.patches];
		server.patches += 1;
		await Promise.resolve();
		if (!step?.patch) throw new Error('offline');
		server.data = { ...server.data, ...structuredClone(patch) } as never;
	});
	const reload = async () => {
		const step = steps[server.reloads];
		server.reloads += 1;
		await Promise.resolve();
		if (!step?.reload) throw new Error('offline');
		return structuredClone(server.data);
	};
	return { server, reload };
};

const Harness = ({
	reload,
	children
}: {
	reload: () => Promise<unknown>;
	children: React.ReactNode;
}) => {
	const [userData, setUserData] = React.useState(initialUserData);
	const reloadUserData = React.useCallback(async () => {
		const fresh = await reload();
		setUserData(fresh as never);
		return fresh;
	}, [reload]);
	return (
		<MemoryRouter>
			<AppConfigContext.Provider
				value={
					{
						releaseToggles: { enableNewNotifications: true }
					} as never
				}
			>
				<NotificationsContext.Provider
					value={{ addNotification: vi.fn() } as never}
				>
					<UserDataContext.Provider
						value={{ userData, reloadUserData } as never}
					>
						{children}
					</UserDataContext.Provider>
				</NotificationsContext.Provider>
			</AppConfigContext.Provider>
		</MemoryRouter>
	);
};

const ConnectedDialog = () => {
	const email = useDisplayFilterEmailColumn('sessions');
	return (
		<DisplayFilterDialog
			open
			onClose={() => undefined}
			onReset={() => undefined}
			onChange={() => undefined}
			kinds={SESSION_KINDS}
			value={EMPTY_DISPLAY_FILTER}
			labels={STORY_LABELS}
			columns={SESSION_COLUMNS}
			email={email}
		/>
	);
};

const settle = async (
	server: { patches: number; reloads: number },
	n: number
) => {
	await waitFor(() => {
		expect(server.patches).toBe(n);
		expect(server.reloads).toBe(n);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

beforeEach(() => {
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn()
	});
});
afterEach(() => {
	cleanup();
	vi.mocked(apiPatchUserData).mockReset();
});

describe('e-mail setting: shown value equals the stored one after any write sequence', () => {
	it.each(CASES.map((steps) => [label(steps), steps] as const))(
		'profile switch, rapid: %s',
		async (_, steps) => {
			const { server, reload } = serve(steps);
			render(
				<Harness reload={reload}>
					<EmailToggle
						name="emailNotificationsEnabled"
						titleKey="profile.notifications.mainEmail.title"
					/>
				</Harness>
			);
			const toggle = screen.getByRole('switch') as HTMLInputElement;
			for (let i = 0; i < steps.length; i += 1) fireEvent.click(toggle);
			await settle(server, steps.length);
			expect(toggle.checked).toBe(
				readEmailSetting(server.data, {
					kind: 'path',
					name: 'emailNotificationsEnabled'
				})
			);
		}
	);

	it.each(CASES.map((steps) => [label(steps), steps] as const))(
		'profile switch, each change after the last settled: %s',
		async (_, steps) => {
			const { server, reload } = serve(steps);
			render(
				<Harness reload={reload}>
					<EmailToggle
						name="emailNotificationsEnabled"
						titleKey="profile.notifications.mainEmail.title"
					/>
				</Harness>
			);
			const toggle = screen.getByRole('switch') as HTMLInputElement;
			for (let i = 0; i < steps.length; i += 1) {
				fireEvent.click(toggle);
				await settle(server, i + 1);
				expect(toggle.checked).toBe(
					readEmailSetting(server.data, {
						kind: 'path',
						name: 'emailNotificationsEnabled'
					})
				);
			}
		}
	);

	it.each(CASES.map((steps) => [label(steps), steps] as const))(
		'display-filter E-Mail column, rapid: %s',
		async (_, steps) => {
			const { server, reload } = serve(steps);
			render(
				<Harness reload={reload}>
					<ConnectedDialog />
				</Harness>
			);
			const picker = screen.getByRole('button', {
				name: 'E-Mail: Termine'
			});
			// Stored: An. Alternate Aus / An / Aus, each before any answer.
			steps.forEach((_, i) => {
				fireEvent.click(
					screen.getByRole('button', {
						name: 'E-Mail wählen: Termine'
					})
				);
				fireEvent.click(
					screen.getByRole('menuitemradio', {
						name: i % 2 === 0 ? 'Aus' : 'An'
					})
				);
			});
			await settle(server, steps.length);
			const stored = readEmailSetting(server.data, {
				kind: 'settings',
				field: 'appointmentNotificationEnabled'
			});
			expect(picker.textContent).toContain(stored ? 'An' : 'Aus');
			expect(picker.textContent).not.toContain(stored ? 'Aus' : 'An');
		}
	);

	// The master switch gates the column: its availability must follow the
	// shown master value too, not the possibly stale context.
	it.each(CASES.map((steps) => [label(steps), steps] as const))(
		'display-filter availability follows the profile master switch, rapid: %s',
		async (_, steps) => {
			const { server, reload } = serve(steps);
			render(
				<Harness reload={reload}>
					<EmailToggle
						name="emailNotificationsEnabled"
						titleKey="profile.notifications.mainEmail.title"
					/>
					<ConnectedDialog />
				</Harness>
			);
			// The open dialog is modal: the profile behind it is aria-hidden.
			const master = screen.getByRole('switch', {
				name: 'profile.notifications.mainEmail.title',
				hidden: true
			}) as HTMLInputElement;
			for (let i = 0; i < steps.length; i += 1) fireEvent.click(master);
			await settle(server, steps.length);
			const masterOn = readEmailSetting(server.data, {
				kind: 'path',
				name: 'emailNotificationsEnabled'
			});
			expect(master.checked).toBe(masterOn);
			expect(
				screen.queryByRole('button', { name: 'E-Mail: Termine' }) !==
					null
			).toBe(masterOn);
			const row = screen.getByRole('row', { name: /Termine/ });
			expect(
				row.querySelector('.displayFilterDialog__unavailableReason')
					?.textContent ?? null
			).toBe(
				masterOn ? null : 'notifications.displayFilter.emailMasterOff'
			);
		}
	);
});
