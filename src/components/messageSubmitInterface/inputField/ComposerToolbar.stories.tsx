import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { ComposerToolbar } from './ComposerToolbar';
import { getMenuDirection } from './menuDirection';

const TOOLBAR_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7086-46390';

function ToolbarHarness({
	isMobile = false,
	isExpanded = false
}: {
	isMobile?: boolean;
	isExpanded?: boolean;
}) {
	const { t } = useTranslation();
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	// Call the production rule rather than restating it. The harness used to
	// compute `isExpanded && !isMobile`, while getMenuDirection ignored isMobile
	// entirely — so the story modelled a mobile behaviour the app never had, and
	// that is why #1250 got through review.
	const direction = getMenuDirection({ isExpanded });
	return (
		<div
			style={{
				position: 'relative',
				width: isMobile ? 360 : 900,
				minHeight: isExpanded ? 60 : 260,
				display: 'flex',
				alignItems: isExpanded ? 'flex-start' : 'flex-end',
				padding: 16,
				background: '#fff',
				border: '1px solid var(--m3-primary-fixed, #ffdad5)',
				borderRadius: '24px 4px 24px 24px'
			}}
		>
			<ComposerToolbar
				direction={direction}
				isMobile={isMobile}
				isExpanded={isExpanded}
				onAction={(a) => setSelected((s) => ({ ...s, [a]: !s[a] }))}
				isActionSelected={(a) => !!selected[a]}
				onCollapse={() => {}}
				onExpandToggle={() => {}}
				translate={t}
			/>
		</div>
	);
}

const meta = {
	title: 'Components/Composer/Toolbar',
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		design: [
			{ type: 'figma', name: 'Tip Tap Menu', url: TOOLBAR_FIGMA_URL }
		],
		docs: {
			description: {
				component:
					'Full editor toolbar (Figma 7086:46390 / 487:19879). Desktop shows every group; ' +
					'mobile collapses to the compact set + kebab overflow. Heading/list/align/highlight ' +
					'menus open bottom-to-top when docked or on mobile, top-down in fullscreen.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopDocked: Story = {
	render: () => <ToolbarHarness />
};

export const DesktopFullscreen: Story = {
	render: () => <ToolbarHarness isExpanded />
};

export const MobileCompact: Story = {
	render: () => <ToolbarHarness isMobile />
};

export const TextStyleMenuOpensUp: Story = {
	name: 'Text style menu opens upward (docked)',
	render: () => <ToolbarHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Textstil' })
		);
		/*
		 * #1250: assert the menu is ON SCREEN, not that it went a particular
		 * way. 'up' is the docked preference, but flip() overrules it when
		 * there is not enough room above — fitting beats the fixed rule. The
		 * old version asserted the direction and was excluded from the test
		 * run, so it never caught anything either way.
		 */
		const menu = await waitFor(() => {
			const node = document.querySelector<HTMLElement>(
				'.composerToolbar__menu'
			);
			if (!node) {
				throw new Error('menu did not open');
			}
			return node;
		});
		const box = menu.getBoundingClientRect();
		await expect(box.top).toBeGreaterThanOrEqual(-1);
		await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
		await expect(box.height).toBeGreaterThan(0);
		// #995: body text first, then the four German heading names.
		await expect(
			within(document.body)
				.getAllByRole('menuitemradio')
				.map((item) => item.textContent?.replace(/^(T|H[1-4])/, ''))
		).toEqual([
			'Normaler Text',
			'Titel',
			'Große Überschrift',
			'Mittlere Überschrift',
			'Kleine Überschrift'
		]);
	}
};

export const TextStyleMenuOpensDownInFullscreen: Story = {
	name: 'Text style menu opens downward (fullscreen)',
	render: () => <ToolbarHarness isExpanded />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Textstil' })
		);
		await waitFor(async () => {
			const menu = document.querySelector('.composerToolbar__menu');
			await expect(menu?.className).toContain(
				'composerToolbar__menu--down'
			);
		});
	}
};

export const MobileOverflowMenu: Story = {
	render: () => <ToolbarHarness isMobile />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Weitere Werkzeuge' })
		);
		await waitFor(async () => {
			await expect(
				within(document.body).getByRole('menuitemcheckbox', {
					name: 'Fett'
				})
			).toBeInTheDocument();
		});
	}
};

/**
 * #1250 — mobile + maximised + overflow menu, with the toolbar pinned near the
 * bottom edge. This is the reported case: the ⋮ menu preferred to open
 * downward from a toolbar already at the bottom of a phone screen, so the last
 * entries ran off the edge and were unreachable.
 *
 * No story covered this before, which is how it shipped.
 */
function BottomAnchoredToolbar() {
	const { t } = useTranslation();
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	return (
		<div
			style={{
				position: 'fixed',
				left: 0,
				right: 0,
				// Deliberately close to the bottom edge: the preferred
				// direction cannot fit here.
				bottom: 8,
				display: 'flex',
				justifyContent: 'flex-start',
				padding: 8,
				background: '#fff'
			}}
		>
			<ComposerToolbar
				direction={getMenuDirection({ isExpanded: true })}
				isMobile
				isExpanded
				onAction={(a) => setSelected((s) => ({ ...s, [a]: !s[a] }))}
				isActionSelected={(a) => !!selected[a]}
				onCollapse={() => {}}
				onExpandToggle={() => {}}
				translate={t}
			/>
		</div>
	);
}

export const MobileMaximisedOverflowAtBottomEdge: Story = {
	name: 'Mobile — maximised ⋮ menu at the bottom edge (#1250)',
	parameters: {
		layout: 'fullscreen',
		viewport: {
			options: {
				phone390: {
					name: 'Phone 390',
					styles: { width: '390px', height: '600px' }
				}
			}
		}
	},
	globals: { viewport: { value: 'phone390' } },
	render: () => <BottomAnchoredToolbar />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Weitere Werkzeuge' })
		);

		const menu = await waitFor(() => {
			const node = document.querySelector<HTMLElement>(
				'.composerToolbar__menu'
			);
			if (!node) {
				throw new Error('overflow menu did not open');
			}
			return node;
		});

		await waitFor(async () => {
			const box = menu.getBoundingClientRect();
			// The whole menu is on screen. Before the collision check this
			// opened downward from a bottom-anchored toolbar and the last
			// entries were below the fold.
			await expect(box.top).toBeGreaterThanOrEqual(-1);
			await expect(box.bottom).toBeLessThanOrEqual(
				window.innerHeight + 1
			);
			await expect(box.height).toBeGreaterThan(0);
		});

		// …and the last entry in particular is reachable, not just the box.
		const entries = menu.querySelectorAll<HTMLElement>(
			'.composerToolbar__menuItem'
		);
		await expect(entries.length).toBeGreaterThan(0);
		const last = entries[entries.length - 1].getBoundingClientRect();
		await expect(last.bottom).toBeLessThanOrEqual(window.innerHeight + 1);

		// The menu must not cover the button that opened it.
		const trigger = (
			await canvas.findByRole('button', { name: 'Weitere Werkzeuge' })
		).getBoundingClientRect();
		const box = menu.getBoundingClientRect();
		const overlaps = box.top < trigger.bottom && box.bottom > trigger.top;
		await expect(overlaps).toBe(false);
	}
};
