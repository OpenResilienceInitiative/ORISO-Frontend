import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { ComposerToolbar } from './ComposerToolbar';
import { PlatformFormatsProvider } from '../__storybook__/PlatformFormatsProvider';
import {
	CHAT_COMPOSER_FORMATS,
	type ChatComposerFormat
} from '../../message/chatMessageConfig';

const label = (key: string) => i18next.t(`message.submit.toolbar.${key}`);

type Args = {
	disabledFormats: ChatComposerFormat[];
	isMobile: boolean;
	onAction: (action: string) => void;
};

const Toolbar = ({ isMobile, onAction }: Omit<Args, 'disabledFormats'>) => {
	const { t } = useTranslation();
	return (
		<div
			style={{
				width: isMobile ? 360 : 900,
				minHeight: 240,
				display: 'flex',
				alignItems: 'flex-end',
				padding: 16
			}}
		>
			<ComposerToolbar
				direction="up"
				isMobile={isMobile}
				isExpanded={false}
				onAction={onAction}
				isActionSelected={() => false}
				onCollapse={() => {}}
				onExpandToggle={() => {}}
				translate={t}
			/>
		</div>
	);
};

const meta = {
	title: 'Components/Composer/Toolbar/Platform formats',
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'The formats a platform admin offers (Admin -> Einstellungen -> Chat-Nachrichten). ' +
					'Tick formats in the `disabledFormats` control to switch them off and on: the button ' +
					'goes and comes back without a reload.'
			}
		}
	},
	argTypes: {
		disabledFormats: {
			control: 'check',
			options: [...CHAT_COMPOSER_FORMATS]
		},
		isMobile: { control: 'boolean' }
	},
	args: { disabledFormats: [], isMobile: false, onAction: fn() },
	render: ({ disabledFormats, ...args }) => (
		<PlatformFormatsProvider disabledFormats={disabledFormats}>
			<Toolbar {...args} />
		</PlatformFormatsProvider>
	)
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** Never configured: exactly today's toolbar. */
export const EveryFormatOffered: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const key of [
			'heading',
			'list',
			'quote',
			'codeBlock',
			'bold',
			'italic',
			'strike',
			'code',
			'underline',
			'highlight',
			'link',
			'superscript',
			'subscript',
			'addImage'
		]) {
			await expect(
				canvas.getByRole('button', { name: label(key) })
			).toBeVisible();
		}
	}
};

export const SomeFormatsHidden: Story = {
	args: { disabledFormats: ['bold', 'underline', 'link', 'codeBlock'] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const key of ['bold', 'underline', 'link', 'codeBlock']) {
			await expect(
				canvas.queryByRole('button', { name: label(key) })
			).toBeNull();
		}
		await expect(
			canvas.getByRole('button', { name: label('italic') })
		).toBeVisible();
	}
};

/** The list menu shows only what is on; the heading menu goes with its format. */
export const MenusFollowTheirFormats: Story = {
	args: { disabledFormats: ['heading', 'taskList'] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole('button', { name: label('heading') })
		).toBeNull();
		await userEvent.click(
			canvas.getByRole('button', { name: label('list') })
		);
		const page = within(document.body);
		const bulletList = await page.findByRole('menuitemradio', {
			name: label('bulletList')
		});
		// The menu starts off-screen until floating-ui has placed it.
		await waitFor(() => expect(bulletList).toBeVisible());
		await expect(
			page.queryByRole('menuitemradio', { name: label('taskList') })
		).toBeNull();
		await userEvent.keyboard('{Escape}');
	}
};

/** Nothing offered: the tools that are not formats stay, and no menu is left empty. */
export const EveryFormatHidden: Story = {
	args: { disabledFormats: [...CHAT_COMPOSER_FORMATS] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('button', { name: label('undo') })
		).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: label('list') })
		).toBeNull();
		await expect(
			canvas.queryByRole('button', { name: label('bold') })
		).toBeNull();
	}
};

/** The phone's kebab menu follows the same setting. */
export const MobileOverflowFollowsTheSetting: Story = {
	args: { isMobile: true, disabledFormats: ['bold', 'dateTime'] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: label('more') })
		);
		const page = within(document.body);
		const italic = await page.findByRole('menuitemcheckbox', {
			name: label('italic')
		});
		await waitFor(() => expect(italic).toBeVisible());
		await expect(
			page.queryByRole('menuitemcheckbox', { name: label('bold') })
		).toBeNull();
		await expect(
			page.queryByRole('menuitem', { name: label('dateTime') })
		).toBeNull();
		await userEvent.keyboard('{Escape}');
	}
};

const OffAndOnAgainHarness = ({ onAction }: Pick<Args, 'onAction'>) => {
	const [boldOffered, setBoldOffered] = useState(true);
	return (
		<>
			<label>
				<input
					type="checkbox"
					checked={boldOffered}
					onChange={(event) => setBoldOffered(event.target.checked)}
				/>
				Platform offers bold
			</label>
			<PlatformFormatsProvider
				disabledFormats={boldOffered ? [] : ['bold']}
			>
				<Toolbar isMobile={false} onAction={onAction} />
			</PlatformFormatsProvider>
		</>
	);
};

/** Both directions: gone when switched off, back and working when switched on. */
export const OffAndOnAgain: Story = {
	render: ({ onAction }) => <OffAndOnAgainHarness onAction={onAction} />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const platformSwitch = canvas.getByRole('checkbox', {
			name: 'Platform offers bold'
		});
		await userEvent.click(platformSwitch);
		await expect(
			canvas.queryByRole('button', { name: label('bold') })
		).toBeNull();

		await userEvent.click(platformSwitch);
		await userEvent.click(
			canvas.getByRole('button', { name: label('bold') })
		);
		await expect(args.onAction).toHaveBeenCalledWith('bold');
	}
};
