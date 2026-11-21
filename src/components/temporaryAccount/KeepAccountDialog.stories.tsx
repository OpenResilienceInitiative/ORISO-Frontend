import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { KeepAccountDialog } from './KeepAccountDialog';

/**
 * **Konto behalten** (UserService#1662): a guest who joined without an
 * account keeps it by choosing a password. Same password policy and rule
 * chips as the registration; the login name stays. Offered at the entry
 * ("Konto anlegen") and later from the conversation menu and the profile.
 *
 * The stories answer `POST /users/temporary-account/keep` in the browser,
 * so the dialog runs its real request.
 */
const keepEndpoint = (status: number) => () => {
	const original = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url.includes('/service/users/temporary-account/keep')) {
			return new Response(status === 204 ? null : '{}', { status });
		}
		return original(input, init);
	};
	return () => {
		globalThis.fetch = original;
	};
};

const meta: Meta<typeof KeepAccountDialog> = {
	title: 'Temporary account/Keep account dialog',
	component: KeepAccountDialog,
	parameters: { layout: 'fullscreen' },
	globals: desktop1440Globals,
	args: {
		open: true,
		userName: 'eule_mika_4821',
		account: { chatRecoveryMode: 'RECOVERY_KEY' },
		onClose: fn(),
		onKept: fn()
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const PASSWORD = 'Sonnenblume-2026-Lang!';

const typePasswords = async (
	canvasElement: HTMLElement,
	first: string,
	second = first
) => {
	const page = body(canvasElement);
	await userEvent.type(await page.findByLabelText('Passwort'), first);
	await userEvent.type(page.getByLabelText('Passwort wiederholen'), second);
};

const submit = (canvasElement: HTMLElement) =>
	body(canvasElement).getByRole('button', { name: 'Konto behalten' });

export const Empty: Story = {
	name: 'Empty · desktop',
	play: async ({ canvasElement }) => {
		const page = body(canvasElement);
		const name = await page.findByText('Ihr Benutzername: eule_mika_4821');
		// The dialog fades in.
		await waitFor(() => expect(name).toBeVisible());
		await expect(submit(canvasElement)).toBeDisabled();
	}
};

export const EmptyPhone: Story = {
	name: 'Empty · phone 390',
	globals: phone390Globals
};

export const Mismatch: Story = {
	name: 'Passwords differ',
	play: async ({ canvasElement }) => {
		await typePasswords(canvasElement, PASSWORD, `${PASSWORD}x`);
		await expect(
			body(canvasElement).getByText(
				'Die Passwörter stimmen nicht überein.'
			)
		).toBeVisible();
		await expect(submit(canvasElement)).toBeDisabled();
	}
};

export const Kept: Story = {
	name: 'Kept · 204',
	beforeEach: keepEndpoint(204),
	play: async ({ args, canvasElement }) => {
		await typePasswords(canvasElement, PASSWORD);
		await waitFor(() => expect(submit(canvasElement)).toBeEnabled());
		await userEvent.click(submit(canvasElement));
		await expect(
			await body(canvasElement).findByText('Ihr Konto bleibt erhalten.')
		).toBeVisible();
		await expect(args.onKept).toHaveBeenCalledWith('kept');
	}
};

export const RefusedForbidden: Story = {
	name: 'Refused · 403 (not entered under "Gast wählt")',
	beforeEach: keepEndpoint(403),
	play: async ({ args, canvasElement }) => {
		await typePasswords(canvasElement, PASSWORD);
		await userEvent.click(submit(canvasElement));
		await expect(
			await body(canvasElement).findByRole('alert')
		).toHaveTextContent(
			'Über diese Einladung lässt sich das Konto nicht behalten.'
		);
		await expect(args.onKept).not.toHaveBeenCalled();
	}
};

export const RefusedConflict: Story = {
	name: 'Refused · 409 (being deleted or already permanent)',
	beforeEach: keepEndpoint(409),
	play: async ({ canvasElement }) => {
		await typePasswords(canvasElement, PASSWORD);
		await userEvent.click(submit(canvasElement));
		await expect(
			await body(canvasElement).findByRole('alert')
		).toHaveTextContent('Ihr Konto wird gerade gelöscht');
	}
};
