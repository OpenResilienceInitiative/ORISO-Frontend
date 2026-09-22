import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import {
	CircleSettingsStage,
	COLLEAGUES
} from '../conversationCreate/circle/circleSettingsStage';
import { GroupChatShareDialog } from './GroupChatShareDialog';
import { buildGroupChatInviteLinkForOrigin } from './groupChatInviteLink';
import {
	effectiveBackground,
	wcagContrast
} from '../../utils/theme/wcagContrast';

/**
 * #1499 item 5. Wired in `CircleSettingsView` after every successful create;
 * the wired flow is the `Create → share dialog` story on the settings stage.
 *
 * After "Erstellen" on a Gesprächskreis / call this dialog shows the invite link (the existing `/login?gcid=<seriesId>` link that
 * `GroupChatCopyLinks` also copies) with a copy action and every detail the
 * author just chose. Desktop: M3 basic dialog over the create stage. Phone:
 * M3 full-screen dialog; the copy button drops under the field.
 *
 * No QR code and no native share button (Frank, #1499 round 2).
 */

/* A neutral dev-looking host: the real link is built from the host the app
   runs on (`currentHostGroupChatInviteLink`), never a production URL. */
const LINK = buildGroupChatInviteLinkForOrigin(
	'https://dev.oriso.example',
	4711
);

const VIDEO_DETAILS = {
	topic: 'Sucht',
	startDate: '2026-09-24',
	startTime: '18:00',
	duration: 90,
	repeatCount: 6,
	interval: 'WEEKLY' as const,
	modality: 'VIDEO' as const,
	language: 'de'
};

const meta = {
	title: 'GroupChat/Share dialog after create',
	component: GroupChatShareDialog,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	args: {
		open: true,
		onClose: fn(),
		onCopy: fn(),
		link: LINK,
		details: VIDEO_DETAILS,
		fullScreen: false
	},
	render: (args) => (
		<>
			<CircleSettingsStage
				layout={args.fullScreen ? 'mobile' : 'desktop'}
				people={COLLEAGUES}
				activeLanguages={['de', 'en', 'ru']}
			/>
			<GroupChatShareDialog {...args} />
		</>
	)
} satisfies Meta<typeof GroupChatShareDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

/* MUI fades the dialog in; wait for the transition before checking text. */
const openDialog = async (canvasElement: HTMLElement, name: string) => {
	const dialog = await page(canvasElement).findByRole('dialog', { name });
	await waitFor(() => expect(dialog).toBeVisible());
	return dialog;
};

const showsLinkAndDetails: Story['play'] = async ({ canvasElement }) => {
	const dialog = await openDialog(canvasElement, 'Video-Call angelegt');
	const body = within(dialog);
	await expect(body.getByLabelText('Einladungs-Link')).toHaveValue(LINK);
	for (const label of [
		'Thema',
		'Datum',
		'Beginn',
		'Dauer',
		'Wiederholungen',
		'Format',
		'Sprache'
	]) {
		await expect(body.getByText(label)).toBeVisible();
	}
	await expect(body.getByText('6 Termine, Wöchentlich')).toBeVisible();
};

const copyAndClose: Story['play'] = async ({ canvasElement, args }) => {
	const body = within(await openDialog(canvasElement, 'Video-Call angelegt'));
	await userEvent.click(body.getByRole('button', { name: 'Link kopieren' }));
	await expect(args.onCopy).toHaveBeenCalledWith(LINK);
	await expect(
		await body.findByRole('button', { name: 'Kopiert' })
	).toBeVisible();

	await userEvent.click(body.getByRole('button', { name: 'Fertig' }));
	await expect(args.onClose).toHaveBeenCalled();
};

/** Video call, desktop: basic dialog over the create stage. */
export const VideoCallDesktop: Story = {
	name: 'Video call · 1440',
	globals: desktop1440Globals,
	play: showsLinkAndDetails
};

/** Copy flips the button to "Kopiert"; "Fertig" closes. */
export const CopyLinkInteraction: Story = {
	name: 'Copy link, then close · 1440',
	globals: desktop1440Globals,
	play: copyAndClose
};

/** Same content as a full-screen sheet on a phone. */
export const VideoCallMobile: Story = {
	name: 'Video call · 390 (full screen)',
	globals: phone390Globals,
	args: { fullScreen: true },
	play: showsLinkAndDetails
};

/** A one-off text circle: the title and format follow the modality. */
export const TextCircleOnce: Story = {
	name: 'Text circle, one date · 1440',
	globals: desktop1440Globals,
	args: {
		details: {
			...VIDEO_DETAILS,
			modality: 'TEXT',
			repeatCount: 1,
			duration: 60,
			language: 'en'
		}
	},
	play: async ({ canvasElement }) => {
		const dialog = await openDialog(
			canvasElement,
			'Gesprächskreis angelegt'
		);
		await expect(within(dialog).getByText('einmalig')).toBeVisible();
		await expect(within(dialog).getByText('Text')).toBeVisible();
	}
};

/** Träger 2 on Dev: a light-blue brand colour (#1499 Dev test). */
const TRAEGER_2_SEED = '#b4ddee';

const textContrast = (element: HTMLElement) =>
	wcagContrast(getComputedStyle(element).color, effectiveBackground(element));

/**
 * Dev test of #1499: with Träger 2's light-blue brand colour the text
 * button "Fertig" read at ~1.2:1. The palette now darkens a brand colour
 * that is too light for text, so it reaches WCAG AA (4.5:1).
 */
export const LightBrandColour1440: Story = {
	name: 'Light brand colour (Träger 2) · 1440',
	globals: desktop1440Globals,
	parameters: { orisoSeed: TRAEGER_2_SEED },
	play: async ({ canvasElement }) => {
		const dialog = within(
			await openDialog(canvasElement, 'Video-Call angelegt')
		);
		await expect(
			textContrast(dialog.getByRole('button', { name: 'Fertig' }))
		).toBeGreaterThanOrEqual(4.5);
	}
};
