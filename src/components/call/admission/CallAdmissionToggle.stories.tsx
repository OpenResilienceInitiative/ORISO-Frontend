import * as React from 'react';
import { useState } from 'react';
import i18n from 'i18next';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Box } from '@mui/material';
import { CallAdmissionToggle } from './CallAdmissionToggle';
import { createMemoryCallShareSettingsStore } from './callAdmission';
import { desktop1440Globals } from '../../message/messageStoryShell';

interface AdmissionStoryProps {
	/** `CallShareSettings.knock` at the start. */
	knock: boolean;
	/** A second switch on the same store, standing in for the share popover. */
	withSharePopover?: boolean;
}

const AdmissionStory = ({ knock, withSharePopover }: AdmissionStoryProps) => {
	// One store per story render; `knock` is only the starting value.
	const [store] = useState(() =>
		createMemoryCallShareSettingsStore({ knock, temporaryAccount: true })
	);
	return (
		<Box
			sx={{
				minHeight: '100vh',
				p: 3,
				backgroundColor: 'var(--m3-surface-container, #f3edec)'
			}}
		>
			<Box
				sx={{
					position: 'relative',
					width: 'min(720px, 100%)',
					height: 420,
					mx: 'auto',
					borderRadius: '16px',
					backgroundColor: '#000',
					p: 1.5,
					boxSizing: 'border-box',
					display: 'flex',
					flexDirection: 'column',
					gap: 1.5,
					alignItems: 'flex-start'
				}}
			>
				<Box sx={{ width: 320 }} data-testid="in-call">
					<CallAdmissionToggle store={store} />
				</Box>
				{withSharePopover && (
					<Box sx={{ width: 320 }} data-testid="share-popover">
						<CallAdmissionToggle store={store} />
					</Box>
				)}
			</Box>
		</Box>
	);
};

/**
 * #1892 scope extension (Frank, 28 Oct), FE#1794 §3: a switch in the running
 * call turns knocking on or off. It is the same setting as the per-link
 * "Anklopfen" toggle of the share popover (FE#1794, PR #1910).
 *
 * Storybook only: UserService has no API for this setting yet (see the TODO
 * in `callAdmission.ts`), so the switch runs on an in-memory store and is not
 * mounted in the call.
 */
const meta = {
	title: 'Components/Call/Knock admission switch',
	component: AdmissionStory,
	tags: ['autodocs'],
	args: { knock: true },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Schalter „Anklopfen“ im laufenden Anruf: an — Gäste warten, bis die Beraterin sie einlässt; aus — Gäste kommen direkt in den Anruf. Dieselbe Einstellung wie im Teilen-Popover (#1794). Noch ohne Backend: Speicher nur im Browser, im Anruf noch nicht eingebaut.'
			}
		}
	}
} satisfies Meta<typeof AdmissionStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const switchIn = (scope: HTMLElement) =>
	within(scope).getByRole('switch', {
		name: i18n.t('calls.admission.label')
	});

/** Knocking on: the default. */
export const KnockOn: Story = {
	globals: desktop1440Globals,
	play: async ({ canvas }) => {
		const toggle = await canvas.findByTestId('call-admission-toggle');
		await expect(switchIn(toggle)).toBeChecked();
		await expect(toggle).toHaveTextContent(i18n.t('calls.admission.on'));
	}
};

/** Knocking off: guests join directly. */
export const KnockOff: Story = {
	globals: desktop1440Globals,
	args: { knock: false },
	play: async ({ canvas }) => {
		const toggle = await canvas.findByTestId('call-admission-toggle');
		await expect(switchIn(toggle)).not.toBeChecked();
		await expect(toggle).toHaveTextContent(i18n.t('calls.admission.off'));
	}
};

/**
 * Switched off from the keyboard inside the call: the share popover's
 * switch, on the same store, follows.
 */
export const SameSettingAsTheSharePopover: Story = {
	globals: desktop1440Globals,
	args: { withSharePopover: true },
	play: async ({ canvas }) => {
		const inCall = switchIn(await canvas.findByTestId('in-call'));
		const popover = switchIn(canvas.getByTestId('share-popover'));
		inCall.focus();
		await userEvent.keyboard(' ');
		await waitFor(() => expect(inCall).not.toBeChecked());
		await expect(popover).not.toBeChecked();
		await userEvent.click(popover);
		await waitFor(() => expect(inCall).toBeChecked());
	}
};
