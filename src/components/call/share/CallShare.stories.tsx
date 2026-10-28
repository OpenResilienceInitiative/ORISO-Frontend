import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CallShare } from './CallShare';
import { CallShareStage } from './callShareStage';

/**
 * #1794: share a running call by link. Design only — nothing here is wired
 * into `GroupCallWidget` yet, and the link is a sample.
 *
 * The share button sits in the call toolbar. Desktop: a popover above the
 * button. Phone: a bottom sheet. Inside, as decided by Frank (17 + 27 Oct):
 * "Anklopfen" (on by default), "Temporäres Konto" (on by default for audio
 * and video), the link with Copy, a QR code and the phone's own share menu
 * (only where the browser has one), then one sentence on the lifetime (the
 * link dies at hang-up) and one on consent (guests confirm with one tap in
 * the existing waiting-room consent sheet — no new consent UI here).
 */

/* A neutral dev-looking host; the real link comes from the backend. */
const LINK = 'https://dev.oriso.example/call/join?l=k7Qp2xK9mT';

const desktop1280Globals = { viewport: { value: 'desktop1280' } };
const phone375Globals = { viewport: { value: 'phone375' } };
const phone320Globals = { viewport: { value: 'phone320' } };

const meta = {
	title: 'Components/Call/Share call by link',
	component: CallShare,
	parameters: { layout: 'fullscreen' },
	args: {
		link: LINK,
		layout: 'desktop',
		defaultOpen: true,
		onSettingsChange: fn(),
		onCopy: fn(),
		webShare: fn(async () => undefined)
	},
	render: (args) => (
		<CallShareStage
			layout={args.layout}
			shareButton={<CallShare {...args} />}
		/>
	)
} satisfies Meta<typeof CallShare>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Popover and sheet are portalled to `<body>`, outside the canvas. */
const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

/** The panel once its enter transition (opacity) has finished. */
const sharePanel = async (canvasElement: HTMLElement) => {
	const panel = await page(canvasElement).findByRole('dialog', {
		name: 'Anruf teilen'
	});
	await waitFor(() => expect(panel).toBeVisible());
	return panel;
};

/** Popover default: both toggles on, Copy, QR, Share, both sentences. */
export const PopoverDefault: Story = {
	name: 'Popover – default',
	globals: desktop1280Globals,
	play: async ({ canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		await expect(
			panel.getByRole('switch', { name: 'Anklopfen' })
		).toBeChecked();
		await expect(
			panel.getByRole('switch', { name: 'Temporäres Konto' })
		).toBeChecked();
		await expect(panel.getByRole('textbox')).toHaveValue(LINK);
		await expect(
			panel.getByRole('button', { name: 'Kopieren' })
		).toBeVisible();
		await expect(
			panel.getByRole('button', { name: 'Teilen' })
		).toBeVisible();
		await expect(
			panel.getByText(/Sobald Sie auflegen, funktioniert er nicht mehr/)
		).toBeVisible();
		await expect(panel.getByText(/mit einem Tipp/)).toBeVisible();
	}
};

/** Knocking off and a permanent account: the descriptions say what that means. */
export const BothTogglesOff: Story = {
	name: 'Popover – both toggles off',
	globals: desktop1280Globals,
	args: { initialSettings: { knock: false, temporaryAccount: false } },
	play: async ({ canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		await expect(
			panel.getByRole('switch', { name: 'Anklopfen' })
		).not.toBeChecked();
		await expect(
			panel.getByRole('switch', { name: 'Temporäres Konto' })
		).not.toBeChecked();
		await expect(
			panel.getByText('Gäste kommen ohne Warten direkt in den Anruf.')
		).toBeVisible();
	}
};

/** Switching "Temporäres Konto" off reports the new settings. */
export const TemporaryOff: Story = {
	name: 'Popover – temporary account off',
	globals: desktop1280Globals,
	play: async ({ args, canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		const temporary = panel.getByRole('switch', {
			name: 'Temporäres Konto'
		});
		await userEvent.click(temporary);
		await expect(temporary).not.toBeChecked();
		await expect(args.onSettingsChange).toHaveBeenCalledWith({
			knock: true,
			temporaryAccount: false
		});
		await expect(
			panel.getByText(
				'Gäste melden sich mit einem eigenen Konto an oder legen eines an.'
			)
		).toBeVisible();
		await expect(
			panel.getByRole('switch', { name: 'Anklopfen' })
		).toBeChecked();
	}
};

/** After Copy: the button confirms and a polite live region says it. */
export const Copied: Story = {
	name: 'Popover – copied',
	globals: desktop1280Globals,
	play: async ({ args, canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		await userEvent.click(panel.getByRole('button', { name: 'Kopieren' }));
		await expect(args.onCopy).toHaveBeenCalledWith(LINK);
		await expect(
			await panel.findByRole('button', { name: 'Kopiert' })
		).toBeVisible();
		await expect(
			panel.getByText('Der Link ist in der Zwischenablage.')
		).toBeVisible();
	}
};

/** QR code opened from its button; it carries the same link. */
export const QrExpanded: Story = {
	name: 'Popover – QR code expanded',
	globals: desktop1280Globals,
	play: async ({ canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		const toggle = panel.getByRole('button', { name: 'QR-Code' });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await userEvent.click(toggle);
		await expect(
			panel.getByRole('button', { name: 'QR-Code ausblenden' })
		).toHaveAttribute('aria-expanded', 'true');
		const qr = await panel.findByRole('img', {
			name: 'QR-Code mit dem Link zum Anruf'
		});
		await expect(qr.getAttribute('src')).toMatch(/^data:image\/png/);
		// Re-anchored: the grown popover still ends above the toolbar pill.
		const pill = canvasElement.querySelector('.callShareStage__pill');
		const paper = qr.closest('.callShare__popover');
		await waitFor(() =>
			expect(paper!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				pill!.getBoundingClientRect().top
			)
		);
	}
};

/** Desktop browsers without the Web Share API: no Share button at all. */
export const WebShareUnavailable: Story = {
	name: 'Popover – Web Share unavailable',
	globals: desktop1280Globals,
	args: { webShare: null },
	play: async ({ canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		await expect(
			panel.queryByRole('button', { name: 'Teilen' })
		).not.toBeInTheDocument();
		await expect(
			panel.getByRole('button', { name: 'QR-Code' })
		).toBeVisible();
	}
};

/** From the toolbar: the button opens the popover; Escape closes it. */
export const OpensFromToolbar: Story = {
	name: 'Toolbar button – open and close',
	globals: desktop1280Globals,
	args: { defaultOpen: false },
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole('button', {
			name: 'Anruf teilen'
		});
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await userEvent.click(trigger);
		await sharePanel(canvasElement);
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				page(canvasElement).queryByRole('dialog', {
					name: 'Anruf teilen'
				})
			).not.toBeInTheDocument()
		);
		await waitFor(() => expect(trigger).toHaveFocus());
	}
};

const expectNoSideways = async (canvasElement: HTMLElement) => {
	const panel = await sharePanel(canvasElement);
	await waitFor(() =>
		expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth)
	);
	const box = panel.getBoundingClientRect();
	await expect(box.left).toBeGreaterThanOrEqual(0);
	await expect(box.right).toBeLessThanOrEqual(
		canvasElement.ownerDocument.documentElement.clientWidth
	);
};

/** Phone 375: the same content as a bottom sheet. */
export const PhoneSheet375: Story = {
	name: 'Phone 375 – bottom sheet',
	globals: phone375Globals,
	args: { layout: 'phone' },
	play: async ({ canvasElement }) => {
		await expectNoSideways(canvasElement);
		const panel = within(await sharePanel(canvasElement));
		await expect(
			panel.getByRole('button', { name: 'Teilen' })
		).toBeVisible();
	}
};

/** Phone 320, the smallest supported width: Copy drops under the link. */
export const PhoneSheet320: Story = {
	name: 'Phone 320 – bottom sheet',
	globals: phone320Globals,
	args: { layout: 'phone' },
	play: async ({ canvasElement }) => {
		await expectNoSideways(canvasElement);
	}
};

/** Phone 320 with the QR code open: the sheet scrolls, nothing is cut. */
export const PhoneSheet320Qr: Story = {
	name: 'Phone 320 – QR code expanded',
	globals: phone320Globals,
	args: { layout: 'phone', defaultQrOpen: true },
	play: async ({ canvasElement }) => {
		await expectNoSideways(canvasElement);
		await expect(
			await page(canvasElement).findByRole('img', {
				name: 'QR-Code mit dem Link zum Anruf'
			})
		).toBeInTheDocument();
	}
};

/** Phone browser without the Web Share API: Copy and QR only. */
export const PhoneWebShareUnavailable: Story = {
	name: 'Phone 375 – Web Share unavailable',
	globals: phone375Globals,
	args: { layout: 'phone', webShare: null },
	play: async ({ canvasElement }) => {
		const panel = within(await sharePanel(canvasElement));
		await expect(
			panel.queryByRole('button', { name: 'Teilen' })
		).not.toBeInTheDocument();
	}
};
