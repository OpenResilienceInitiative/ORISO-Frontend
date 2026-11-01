// @vitest-environment oriso-jsdom
import * as React from 'react';
import { createContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext, UserDataContext } from '../../globalState';
import { copyTextToClipboard } from '../../utils/clipboardHelpers';
import { ConsultantInformation } from './ConsultantInformation';

vi.mock('../../globalState', () => ({
	UserDataContext: createContext(null),
	NotificationsContext: createContext(null),
	AUTHORITIES: { CONSULTANT_DEFAULT: 'consultant' },
	hasUserAuthority: (
		authority: string,
		user: { grantedAuthorities?: string[] }
	) => !!user.grantedAuthorities?.includes(authority),
	NOTIFICATION_TYPE_SUCCESS: 'success',
	NOTIFICATION_TYPE_ERROR: 'error'
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		urls: { registration: 'https://beratung.example.org/registration' }
	})
}));
vi.mock('../../utils/clipboardHelpers', () => ({
	copyTextToClipboard: vi.fn(async (_content, callback) => callback?.())
}));
vi.mock('../../api/apiPutConsultantData', () => ({
	apiPutConsultantData: vi.fn()
}));
vi.mock('../generateQrCode/GenerateQrCode', () => ({
	GenerateQrCode: () => null
}));
vi.mock('./ProfileAvatarChoice', () => ({ ProfileAvatarChoice: () => null }));
vi.mock('../tooltip/Tooltip', () => ({ Tooltip: () => null }));
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

const LINK = 'https://beratung.example.org/registration?cid=qa-shazia-2810';
const notify = vi.fn();

const mount = (user: Record<string, unknown> = {}) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: {
						userId: '65c1095e-b977-493a-a34f-064b729d1d6c',
						publicSlug: 'qa-shazia-2810',
						grantedAuthorities: ['consultant'],
						...user
					},
					reloadUserData: vi.fn()
				} as never
			}
		>
			<NotificationsContext.Provider
				value={{ addNotification: notify } as never}
			>
				<ConsultantInformation />
			</NotificationsContext.Provider>
		</UserDataContext.Provider>
	);

const copyButton = () =>
	screen.getByRole('button', {
		name: 'profile.data.personal.registrationLink.title'
	});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe('personal contact link (ORISO-UserService#1534)', () => {
	it('shows the full link built from the active link name', () => {
		mount();

		expect(screen.getByText(LINK).textContent).toBe(LINK);
	});

	it('shows the UUID link while no link name is active', () => {
		mount({ publicSlug: undefined });

		const uuidLink =
			'https://beratung.example.org/registration?cid=65c1095e-b977-493a-a34f-064b729d1d6c';
		expect(screen.getByText(uuidLink).textContent).toBe(uuidLink);
	});

	it('copies the link with the Clipboard API and confirms it', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		});
		mount();

		fireEvent.click(copyButton());

		await waitFor(() =>
			expect(notify).toHaveBeenCalledWith(
				expect.objectContaining({ notificationType: 'success' })
			)
		);
		expect(writeText).toHaveBeenCalledWith(LINK);
		expect(copyTextToClipboard).not.toHaveBeenCalled();
	});

	it('falls back to the legacy copy when the Clipboard API is refused', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
		});
		mount();

		fireEvent.click(copyButton());

		await waitFor(() =>
			expect(copyTextToClipboard).toHaveBeenCalledWith(
				LINK,
				expect.any(Function)
			)
		);
		await waitFor(() => expect(notify).toHaveBeenCalled());
	});
});

describe('link name validation (ORISO-UserService#1534)', () => {
	const editTo = (value: string) => {
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.data.edit.button.edit'
			})
		);
		fireEvent.change(
			screen.getByRole('textbox', {
				name: 'profile.data.publicSlug.input'
			}),
			{ target: { value } }
		);
	};
	// The shared Button marks item.disabled with a class, not the attribute.
	const saveButton = () =>
		screen.getByText('profile.data.edit.button.save').closest('button')!;

	it('allows saving a name with digits', () => {
		mount({ publicSlug: 'qa-shazia-test' });

		editTo('qa-shazia-2810');

		expect(saveButton().className).not.toContain('button__item--disabled');
	});

	it.each(['-qa', 'qa-', 'qa--2810', 'qa shazia', 'qa_2810'])(
		'keeps saving disabled for "%s"',
		(value) => {
			mount({ publicSlug: 'qa-shazia-test' });

			editTo(value);

			expect(saveButton().className).toContain('button__item--disabled');
		}
	);
});
