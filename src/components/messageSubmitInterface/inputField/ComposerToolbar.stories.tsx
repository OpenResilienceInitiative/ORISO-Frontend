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
	isExpanded = false
}: {
	isMobile?: boolean;
	isExpanded?: boolean;
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
				direction={direction}
				isMobile={isMobile}
				isExpanded={isExpanded}
				onAction={(a) =>
					setSelected((s) => ({ ...s, [a]: !s[a] }))
				}
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

export const HeadingMenuOpensUp: Story = {
	name: 'Heading menu opens upward (docked)',
	render: () => <ToolbarHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Heading style' })
		);
		await waitFor(async () => {
			const menu = canvasElement.querySelector('.composerToolbar__menu');
			await expect(menu?.className).toContain(
				'composerToolbar__menu--up'
			);
		});
		await expect(
			canvas.getByRole('menuitem', { name: /Heading 4/ })
		).toBeInTheDocument();
	}
};

export const HeadingMenuOpensDownInFullscreen: Story = {
	name: 'Heading menu opens downward (fullscreen)',
	render: () => <ToolbarHarness isExpanded />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Heading style' })
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
	render: () => <ToolbarHarness isMobile />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'More tools' })
		);
		await waitFor(async () => {
			await expect(
				canvas.getByRole('menuitem', { name: /Bold/ })
			).toBeInTheDocument();
		});
	}
};
