// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import de from '../../resources/i18n/de/common.json';
import { NotificationsContext, UserDataContext } from '../../globalState';
import { apiPatchConsultantData } from '../../api';
import { EnableWalkthrough } from './EnableWalkthrough';

// The real German catalogue, so the test reads what the counsellor reads.
const lookup = (key: string): string =>
	(key
		.split('.')
		.reduce<unknown>(
			(node, part) => (node as Record<string, unknown>)?.[part],
			de
		) as string) ?? key;

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: lookup })
}));

// The globalState barrel pulls lottie-web (crashes in jsdom).
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		UserDataContext: react.createContext(null),
		NotificationsContext: react.createContext({
			addNotification: () => {}
		}),
		NOTIFICATION_TYPE_ERROR: 'error'
	};
});

vi.mock('../../api', () => ({
	apiPatchConsultantData: vi.fn(() => Promise.resolve())
}));

const renderSwitch = (
	isWalkThroughEnabled: boolean,
	{
		reloadUserData = vi.fn(),
		addNotification = vi.fn()
	}: { reloadUserData?: () => void; addNotification?: () => void } = {}
) =>
	render(
		<NotificationsContext.Provider value={{ addNotification } as any}>
			<UserDataContext.Provider
				value={{
					userData: { isWalkThroughEnabled } as any,
					setUserData: vi.fn(),
					reloadUserData
				}}
			>
				<EnableWalkthrough />
			</UserDataContext.Provider>
		</NotificationsContext.Provider>
	);

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('EnableWalkthrough (#1526)', () => {
	it('names the one switch for all tours in the plural', () => {
		renderSwitch(false);

		expect(screen.getByText('Rundgänge automatisch starten')).toBeTruthy();
		expect(
			screen.getByRole('switch', {
				name: 'Rundgänge automatisch starten'
			})
		).toBeTruthy();
	});

	it('says "Aus" and explains the off state when the switch is off', () => {
		renderSwitch(false);

		expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(
			false
		);
		expect(screen.getByText('Aus')).toBeTruthy();
		expect(
			screen.getByText(
				'Aus: Rundgänge starten nicht von selbst. Sie können sie hier jederzeit starten.'
			)
		).toBeTruthy();
		expect(screen.queryByText(/^An:/)).toBeNull();
	});

	it('says "An" and explains the on state when the switch is on', () => {
		renderSwitch(true);

		expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(
			true
		);
		expect(screen.getByText('An')).toBeTruthy();
		expect(
			screen.getByText(
				'An: Der Einführungsrundgang startet von selbst, bis Sie ihn abgeschlossen oder übersprungen haben. Alle Rundgänge können Sie hier jederzeit starten.'
			)
		).toBeTruthy();
		expect(screen.queryByText(/^Aus:/)).toBeNull();
	});

	it('locks the switch while saving and recovers after a failed save', async () => {
		let rejectSave: (reason?: unknown) => void = () => {};
		vi.mocked(apiPatchConsultantData).mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectSave = reject;
				}) as any
		);
		const addNotification = vi.fn();
		const reloadUserData = vi.fn();
		renderSwitch(false, { addNotification, reloadUserData });
		const toggle = screen.getByRole('switch') as HTMLInputElement;

		fireEvent.click(toggle);

		expect(apiPatchConsultantData).toHaveBeenCalledWith({
			walkThroughEnabled: true
		});
		expect(toggle.disabled).toBe(true);

		rejectSave(new Error('PATCH failed'));

		await waitFor(() => expect(toggle.disabled).toBe(false));
		expect(addNotification).toHaveBeenCalledTimes(1);
		expect(reloadUserData).not.toHaveBeenCalled();
		expect(toggle.checked).toBe(false);

		fireEvent.click(toggle);

		expect(apiPatchConsultantData).toHaveBeenCalledTimes(2);
	});
});
