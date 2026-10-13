// @vitest-environment jsdom
import * as React from 'react';
import { createContext } from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext, UserDataContext } from '../../globalState';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { DisplayNameSettings } from './DisplayNameSettings';

vi.mock('../../globalState', () => ({
	UserDataContext: createContext(null),
	NotificationsContext: createContext(null),
	AUTHORITIES: { CONSULTANT_DEFAULT: 'consultant' },
	hasUserAuthority: (
		authority: string,
		user: { grantedAuthorities?: string[] }
	) => !!user.grantedAuthorities?.includes(authority),
	NOTIFICATION_TYPE_ERROR: 'error'
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('../editableData/EditableData', () => ({
	EditableData: (props) => (
		<input
			aria-label={props.label}
			defaultValue={props.initialValue}
			disabled={props.isDisabled}
			onChange={(event) => props.onValueIsValid(event.target.value)}
		/>
	)
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
const reload = vi.fn().mockResolvedValue(undefined);
const notify = vi.fn();
const mount = (
	user = {
		displayName: 'Mara',
		userName: 'mara-login',
		grantedAuthorities: ['consultant']
	}
) =>
	render(
		<UserDataContext.Provider
			value={{ userData: user, reloadUserData: reload } as never}
		>
			<NotificationsContext.Provider
				value={{ addNotification: notify } as never}
			>
				<DisplayNameSettings />
			</NotificationsContext.Provider>
		</UserDataContext.Provider>
	);

describe('Moved display-name editor', () => {
	it('uses the existing patch and reload contract', async () => {
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		mount();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.edit'
			})
		);
		fireEvent.change(screen.getByRole('textbox'), {
			target: { value: 'Mara Neu' }
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		);
		await waitFor(() =>
			expect(apiPatchUserData).toHaveBeenCalledWith({
				displayName: 'Mara Neu'
			})
		);
		await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
	});

	it.each(['success', 'failure'] as const)(
		'ignores repeated saves while pending and permits another edit after %s',
		async (result) => {
			let resolvePatch: () => void;
			let rejectPatch: (reason: Error) => void;
			const pendingPatch = new Promise<void>((resolve, reject) => {
				resolvePatch = resolve;
				rejectPatch = reject;
			});
			vi.mocked(apiPatchUserData).mockReturnValueOnce(pendingPatch);
			mount();
			const edit = () =>
				fireEvent.click(
					screen.getByRole('button', {
						name: 'profile.data.edit.button.edit'
					})
				);
			edit();
			fireEvent.change(screen.getByRole('textbox'), {
				target: { value: 'Mara Neu' }
			});
			const save = screen.getByRole('button', {
				name: 'profile.data.edit.button.save'
			});
			// Both events arrive before React commits the pending-state render.
			act(() => {
				save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
				save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			});
			expect(apiPatchUserData).toHaveBeenCalledTimes(1);
			expect(save.hasAttribute('disabled')).toBe(true);
			expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(
				true
			);
			expect(
				screen
					.getByRole('button', {
						name: 'profile.data.edit.button.cancel'
					})
					.hasAttribute('disabled')
			).toBe(true);
			expect(reload).not.toHaveBeenCalled();
			expect(notify).not.toHaveBeenCalled();
			await act(async () => {
				if (result === 'success') resolvePatch();
				else rejectPatch(new Error('Request failed'));
			});
			expect(reload).toHaveBeenCalledTimes(result === 'success' ? 1 : 0);
			expect(notify).toHaveBeenCalledTimes(result === 'failure' ? 1 : 0);
			vi.mocked(apiPatchUserData).mockResolvedValueOnce(undefined);
			edit();
			fireEvent.click(
				screen.getByRole('button', {
					name: 'profile.data.edit.button.save'
				})
			);
			await waitFor(() =>
				expect(apiPatchUserData).toHaveBeenCalledTimes(2)
			);
		}
	);

	it('preserves empty-name validation and cancellation without a request', () => {
		mount();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.edit'
			})
		);
		fireEvent.change(screen.getByRole('textbox'), {
			target: { value: '  ' }
		});
		expect(
			screen
				.getByRole('button', { name: 'profile.data.edit.button.save' })
				.classList.contains('button__item--disabled')
		).toBe(true);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.cancel'
			})
		);
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});

	it('keeps the existing failure notification', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValue(
			new Error('Request failed')
		);
		mount();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.edit'
			})
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		);
		await waitFor(() =>
			expect(notify).toHaveBeenCalledWith(
				expect.objectContaining({ notificationType: 'error' })
			)
		);
	});

	it('keeps noneditable users read-only', () => {
		mount({
			displayName: 'Mara',
			userName: 'mara-login',
			grantedAuthorities: ['asker']
		});
		expect(
			screen.queryByRole('button', {
				name: 'profile.data.edit.button.edit'
			})
		).toBeNull();
	});
});
