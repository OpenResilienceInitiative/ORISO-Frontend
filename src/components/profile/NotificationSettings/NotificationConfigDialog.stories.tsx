import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	NotificationConfigDialog,
	NotificationConfigView
} from './NotificationConfigDialog';
import {
	DEFAULT_NOTIFICATION_CONFIG,
	NotificationArea,
	NotificationConfig
} from '../../../utils/notificationSettings/notificationConfig';
import type { SoundId } from '../../../utils/notificationSettings/model';
import type { NotificationRole } from '../../../utils/notificationSettings/notificationChannelCapability';
import { previewNotificationSound } from '../../../utils/notificationSettings/soundPlayback';
import { phone390Globals } from '../../message/messageStoryShell';
import './notificationConfigDialog.styles.scss';

const meta: Meta<typeof NotificationConfigDialog> = {
	title: 'Profile/NotificationConfigDialog',
	component: NotificationConfigDialog,
	parameters: { layout: 'fullscreen' }
};
export default meta;

/**
 * The whole dialog, end-to-end: M3Dialog chrome + hero icon + working
 * play buttons that actually play the vendored tones. Click a tone in a row,
 * then its play button — you hear the sound at the row's volume.
 */
const InteractiveDialog = () => {
	const [open, setOpen] = useState(true);
	const [config, setConfig] = useState<NotificationConfig>(
		DEFAULT_NOTIFICATION_CONFIG
	);
	return (
		<>
			{!open && (
				<button type="button" onClick={() => setOpen(true)}>
					Open notification settings
				</button>
			)}
			<NotificationConfigDialog
				role="consultant"
				open={open}
				config={config}
				onConfirm={(next) => {
					setConfig(next);
					setOpen(false);
				}}
				onClose={() => setOpen(false)}
			/>
		</>
	);
};

type DialogStory = StoryObj<typeof NotificationConfigDialog>;

export const Dialog: DialogStory = { render: () => <InteractiveDialog /> };

/** The real exit guard after editing a sound setting and choosing E-mail preferences. */
export const UnsavedEmailNavigation: DialogStory = {
	render: () => <InteractiveDialog />,
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const banner = doc.querySelector<HTMLSelectElement>(
			'[data-cy="notif-banner-requests-new"]'
		)!;
		await userEvent.selectOptions(banner, 'persistent');
		await userEvent.click(
			doc.querySelector<HTMLAnchorElement>(
				'a[href="/profile/einstellungen/email#email-notifications"]'
			)!
		);
		await waitFor(() =>
			expect(
				doc.querySelector('[data-testid="notif-discard-changes"]')
			).toBeVisible()
		);
		await expect(banner.value).toBe('persistent');
	}
};

export const DialogMobile: DialogStory = {
	render: () => <InteractiveDialog />,
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const documentBody = within(doc.body);
		const dialog = await waitFor(() => documentBody.getByRole('dialog'));
		const surface = dialog as HTMLElement;
		const body = dialog.querySelector('.m3Dialog__body') as HTMLElement;
		const footer = dialog.querySelector('.m3Dialog__footer') as HTMLElement;

		// Removing the redundant email controls can make this dialog fit at
		// 390px. Both a fitting body and an independently scrolling body are valid.
		const bodyOverflows = body.scrollHeight > body.clientHeight;
		await expect(getComputedStyle(surface).overflowY).toBe('hidden');
		await expect(getComputedStyle(body).overflowY).toBe('auto');
		const soundSelect = body.querySelector<HTMLSelectElement>(
			'.notifConfig__select'
		)!;
		const soundSelectWrap = soundSelect.closest<HTMLElement>(
			'.notifConfig__selectWrap'
		)!;
		soundSelect.focus();
		await expect(getComputedStyle(soundSelectWrap).outlineStyle).toBe(
			'solid'
		);
		await expect(getComputedStyle(soundSelectWrap).outlineWidth).toBe(
			'2px'
		);
		if (bodyOverflows) {
			body.scrollTop = body.scrollHeight;
			await expect(body.scrollTop).toBeGreaterThan(0);
		}
		await expect(body.contains(footer)).toBe(false);
		await expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			doc.defaultView!.innerHeight
		);
		const confirm = within(footer).getByRole('button', {
			name: /Bestätigen|Confirm|profile\.notifications\.config\.confirm/
		});
		await waitFor(() => expect(confirm).toBeVisible());
	}
};

/**
 * The bare body (tabs + rows) without the dialog chrome — handy for isolating
 * layout. Preview here also plays real audio.
 */
const InteractiveBody = ({
	initialArea = 'requests',
	showLiveChatRow = false,
	role = 'consultant'
}: {
	initialArea?: NotificationArea;
	showLiveChatRow?: boolean;
	role?: NotificationRole;
}) => {
	const [config, setConfig] = useState<NotificationConfig>(
		DEFAULT_NOTIFICATION_CONFIG
	);
	const [area, setArea] = useState<NotificationArea>(initialArea);
	return (
		// The Gespräche tab with the Live-Chat row is 5 rows tall: without the
		// vertical padding it fits the 1280x800 test frame whole.
		<div
			style={{
				maxWidth: 560,
				padding: showLiveChatRow ? '0 16px' : 16
			}}
		>
			<NotificationConfigView
				config={config}
				activeArea={area}
				onAreaChange={setArea}
				onChange={(a, k, field, value) =>
					setConfig((prev) => ({
						...prev,
						[a]: {
							...prev[a],
							[k]: {
								...prev[a][k],
								[field]: value as SoundId | boolean | number
							}
						}
					}))
				}
				onPreview={previewNotificationSound}
				showLiveChatRow={showLiveChatRow}
				role={role}
			/>
		</div>
	);
};

type BodyStory = StoryObj<typeof NotificationConfigView>;

export const Body: BodyStory = { render: () => <InteractiveBody /> };

/**
 * FE#1470: counsellors get their own "Live-Chat-Nachricht" row in Gespräche,
 * with a tone chosen out of the box — a live-chat seeker is waiting now.
 */
export const BodyCounsellorLiveChatRow: BodyStory = {
	name: 'Body – Berater:in mit Live-Chat-Zeile',
	render: () => (
		<InteractiveBody initialArea="conversations" showLiveChatRow />
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector(
			'[data-cy="notif-row-conversations-liveChat"]'
		);
		await expect(row).not.toBeNull();
		await expect(
			canvasElement.querySelector(
				'[data-cy="notif-play-conversations-liveChat"]'
			)
		).not.toBeNull();
	}
};

/** Advice seekers never see the row: their live-chat messages stay on Standard. */
export const BodyAdviceSeekerNoLiveChatRow: BodyStory = {
	name: 'Body – Ratsuchende ohne Live-Chat-Zeile',
	render: () => <InteractiveBody initialArea="conversations" role="asker" />,
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector(
				'[data-cy="notif-row-conversations-liveChat"]'
			)
		).toBeNull();
	}
};

/** Asserts a row's controls are disabled and described by its visible reason. */
const expectDisabledWithReason = async (
	root: Element,
	area: string,
	kind: string
) => {
	const reason = root.querySelector<HTMLElement>(
		`[data-cy="notif-reason-${area}-${kind}"]`
	);
	await expect(reason).not.toBeNull();
	await expect(reason!.textContent!.trim()).not.toBe('');
	for (const control of [
		root.querySelector<HTMLSelectElement>(
			`[data-cy="notif-banner-${area}-${kind}"]`
		)!,
		root.querySelector<HTMLSelectElement>(
			`[data-cy="notif-row-${area}-${kind}"] select.notifConfig__select`
		)!
	]) {
		await expect(control.disabled).toBe(true);
		await expect(control.getAttribute('aria-disabled')).toBe('true');
		await expect(control.getAttribute('aria-describedby')).toBe(reason!.id);
	}
};

/**
 * #778: a counsellor's Anfragen tab. "Neue Anfrage" fires; "Standard" only
 * reaches advice seekers and "@ Erwähnung" has no event in this tab, so both
 * are disabled and say why.
 */
export const BodyCounsellorDisabledChannels: BodyStory = {
	name: 'Body – Berater:in, Kanäle ohne Auslöser deaktiviert',
	render: () => <InteractiveBody initialArea="requests" role="consultant" />,
	play: async ({ canvasElement }) => {
		await expectDisabledWithReason(canvasElement, 'requests', 'standard');
		await expectDisabledWithReason(canvasElement, 'requests', 'mention');
		await expect(
			canvasElement.querySelector('[data-cy="notif-reason-requests-new"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector<HTMLSelectElement>(
				'[data-cy="notif-banner-requests-new"]'
			)!.disabled
		).toBe(false);
	}
};

/** #778: an advice seeker never receives new enquiries — that row is disabled. */
export const BodyAdviceSeekerDisabledChannels: BodyStory = {
	name: 'Body – Ratsuchende, Kanäle ohne Auslöser deaktiviert',
	render: () => <InteractiveBody initialArea="requests" role="asker" />,
	play: async ({ canvasElement }) => {
		await expectDisabledWithReason(canvasElement, 'requests', 'new');
		await expectDisabledWithReason(canvasElement, 'requests', 'mention');
		await expect(
			canvasElement.querySelector<HTMLSelectElement>(
				'[data-cy="notif-banner-requests-standard"]'
			)!.disabled
		).toBe(false);
	}
};
