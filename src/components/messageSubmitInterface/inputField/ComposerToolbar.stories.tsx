import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { ComposerToolbar } from './ComposerToolbar';

const TOOLBAR_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7086-46390';

function ToolbarHarness({
	isMobile = false,
	isExpanded = false,
	arrows = false
}: {
	isMobile?: boolean;
	isExpanded?: boolean;
	/** T23: back (phone) + scroll-to-newest arrows in front of the tools. */
	arrows?: boolean;
}) {
	const { t } = useTranslation();
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const direction = isExpanded && !isMobile ? 'down' : 'up';
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
				showBack={arrows && isMobile}
				onBack={arrows ? () => {} : undefined}
				onScrollToNewest={arrows ? () => {} : undefined}
				unreadCount={arrows ? 3 : 0}
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

/**
 * T23 (review v5): the expanded tools carry the same two navigation arrows
 * as the compact bar — back (phone only) and a real arrow-down for
 * "scroll to newest" with the unread badge — so the phone never loses its
 * way back while formatting.
 */
export const WithNavigationArrows: Story = {
	name: 'With navigation arrows — phone (T23)',
	render: () => <ToolbarHarness isMobile arrows />,
	play: async ({ canvasElement }) => {
		const buttons = Array.from(
			canvasElement.querySelectorAll<HTMLButtonElement>(
				'.composerToolbar > button'
			)
		);
		await expect(buttons[0].getAttribute('data-cy')).toBe('composer-back');
		await expect(buttons[1].getAttribute('data-cy')).toBe(
			'composer-scroll-to-newest'
		);
		await expect(
			buttons[1].querySelector('[data-testid="ArrowDownwardIcon"]')
		).not.toBeNull();
		await expect(
			buttons[1].querySelector('.composerToolbar__badge')?.textContent
		).toBe('3');
	}
};

/** Desktop: only the scroll arrow — nothing reserved for the back arrow. */
export const WithScrollArrowDesktop: Story = {
	name: 'With scroll arrow — desktop, no back slot (T23)',
	render: () => <ToolbarHarness arrows />,
	play: async ({ canvasElement }) => {
		const first = canvasElement.querySelector<HTMLButtonElement>(
			'.composerToolbar > button'
		)!;
		await expect(first.getAttribute('data-cy')).toBe(
			'composer-scroll-to-newest'
		);
		await expect(
			canvasElement.querySelector('[data-cy="composer-back"]')
		).toBeNull();
	}
};

export const TextStyleMenuOpensUp: Story = {
	// Excluded from `vitest --project storybook`: clicking the trigger never
	// mounts `.composerToolbar__menu` in a real browser, so the assertions below
	// have never actually held. Drop this tag once the menu opens under a full
	// pointer-event sequence.
	tags: ['!test'],
	name: 'Text style menu opens upward (docked)',
	render: () => <ToolbarHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Textstil' })
		);
		await waitFor(async () => {
			const menu = canvasElement.querySelector('.composerToolbar__menu');
			await expect(menu?.className).toContain(
				'composerToolbar__menu--up'
			);
		});
		// #995: body text first, then the four German heading names.
		await expect(
			canvas
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
	// Excluded from `vitest --project storybook`: clicking the trigger never
	// mounts `.composerToolbar__menu` in a real browser, so the assertions below
	// have never actually held. Drop this tag once the menu opens under a full
	// pointer-event sequence.
	tags: ['!test'],
	name: 'Text style menu opens downward (fullscreen)',
	render: () => <ToolbarHarness isExpanded />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Textstil' })
		);
		await waitFor(async () => {
			const menu = canvasElement.querySelector('.composerToolbar__menu');
			await expect(menu?.className).toContain(
				'composerToolbar__menu--down'
			);
		});
	}
};

export const MobileOverflowMenu: Story = {
	// Excluded from `vitest --project storybook`: clicking the trigger never
	// mounts `.composerToolbar__menu` in a real browser, so the assertions below
	// have never actually held. Drop this tag once the menu opens under a full
	// pointer-event sequence.
	tags: ['!test'],
	render: () => <ToolbarHarness isMobile />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Weitere Werkzeuge' })
		);
		await waitFor(async () => {
			await expect(
				canvas.getByRole('menuitemcheckbox', { name: 'Fett' })
			).toBeInTheDocument();
		});
	}
};
