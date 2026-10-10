import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Box } from '@mui/material';
import { TemporaryJoinToggle } from './TemporaryJoinToggle';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';

const HINT =
	'Dieser Einladungslink ist unvollständig, daher ist das Beitreten ohne Konto nicht möglich. Bitte registrieren Sie sich mit einem Konto oder fragen Sie nach einem neuen Link.';

/**
 * "Ohne Konto beitreten" on the account step of a group invite (#1499).
 *
 * With a complete link the toggle works. When the link lacks the
 * Beratungsstelle id (`aid`) the backend refuses `temporary`, so the toggle
 * stays visible but disabled and says why, instead of vanishing without
 * explanation.
 */
const meta: Meta<typeof TemporaryJoinToggle> = {
	id: 'registration-temporary-join-toggle',
	title: 'Entry flows/Temporary guests/Join without account toggle',
	component: TemporaryJoinToggle,
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<Box sx={{ maxWidth: 520, p: 2 }}>
				<Story />
			</Box>
		)
	]
};

export default meta;
type Story = StoryObj<typeof TemporaryJoinToggle>;

export const Available: Story = {
	name: '1 — Link vollständig, Desktop',
	globals: desktop1440Globals,
	args: { label: 'Ohne Konto beitreten', onClick: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', {
			name: 'Ohne Konto beitreten'
		});
		await expect(button).toBeEnabled();
		await expect(canvas.queryByText(/unvollständig/)).toBeNull();
		await userEvent.click(button);
		await expect(args.onClick).toHaveBeenCalledTimes(1);
	}
};

const expectDisabledWithHint = async (
	canvasElement: HTMLElement,
	onClick: () => void
) => {
	const canvas = within(canvasElement);
	const button = canvas.getByRole('button', { name: 'Ohne Konto beitreten' });
	await expect(button).toBeDisabled();
	const hint = canvas.getByText(HINT);
	await expect(hint).toBeVisible();
	// The hint is the button's description for assistive technology.
	await expect(button.getAttribute('aria-describedby')).toBe(hint.id);
	await userEvent.click(button).catch(() => undefined);
	await expect(onClick).not.toHaveBeenCalled();
};

export const DisabledIncompleteLinkDesktop: Story = {
	name: '2 — Link ohne Beratungsstellen-ID: deaktiviert mit Hinweis, Desktop',
	globals: desktop1440Globals,
	args: {
		label: 'Ohne Konto beitreten',
		onClick: fn(),
		disabled: true,
		hint: HINT
	},
	play: ({ canvasElement, args }) =>
		expectDisabledWithHint(canvasElement, args.onClick)
};

export const DisabledIncompleteLinkMobile: Story = {
	name: '2 — Link ohne Beratungsstellen-ID: deaktiviert mit Hinweis, mobil',
	globals: phone390Globals,
	args: {
		label: 'Ohne Konto beitreten',
		onClick: fn(),
		disabled: true,
		hint: HINT,
		fullWidth: true
	},
	play: ({ canvasElement, args }) =>
		expectDisabledWithHint(canvasElement, args.onClick)
};
