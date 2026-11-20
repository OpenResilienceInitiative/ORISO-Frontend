import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { Loading } from './Loading';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';

const meta = {
	title: 'FEEDBACK/Loading',
	component: Loading,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Shared orbital loading for the app, entry flows, overlays and attachments. It stays visible while the operation is active and respects reduced motion.'
			}
		}
	},
	args: {
		delayMs: 0,
		size: 'large'
	}
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = { args: { layout: 'page' } };

export const Section: Story = {
	args: { layout: 'section' },
	render: function CheckingSection(args) {
		const { t } = useTranslation();
		return <Loading {...args} label={t('liveChat.entry.checking.text')} />;
	},
	decorators: [
		(Story) => (
			<div style={{ display: 'flex', minHeight: 420, padding: 24 }}>
				<Story />
			</div>
		)
	]
};

export const Inline: Story = {
	args: { layout: 'inline', size: 'small' },
	decorators: [
		(Story) => (
			<div style={{ padding: 24 }}>
				<Story />
			</div>
		)
	]
};

const assertCentered = async (canvasElement: HTMLElement) => {
	const host = canvasElement.querySelector<HTMLElement>(
		'[data-loading-host]'
	);
	const pane = canvasElement.querySelector<HTMLElement>(
		'.stageLayout__content'
	);
	const header = canvasElement.querySelector<HTMLElement>(
		'.stageLayout__header'
	);
	const status = within(canvasElement).getByRole('status');
	const animation = status.querySelector<HTMLElement>('.loading__animation');
	const label = status.querySelector<HTMLElement>('.loading__label');
	expect(host).not.toBeNull();
	expect(animation).not.toBeNull();
	expect(label).not.toBeNull();
	if (!host || !animation || !label) return;

	await waitFor(() => {
		const outer = host.getBoundingClientRect();
		const styles = getComputedStyle(host);
		const left = pane
			? pane.getBoundingClientRect().left +
				parseFloat(getComputedStyle(pane).paddingLeft)
			: outer.left + parseFloat(styles.paddingLeft);
		const right = pane
			? pane.getBoundingClientRect().right -
				parseFloat(getComputedStyle(pane).paddingRight)
			: outer.right - parseFloat(styles.paddingRight);
		const top = header
			? header.getBoundingClientRect().bottom
			: outer.top + parseFloat(styles.paddingTop);
		const bottom = outer.bottom - parseFloat(styles.paddingBottom);
		const orbital = animation.getBoundingClientRect();
		const text = label.getBoundingClientRect();
		expect(
			Math.abs((orbital.left + orbital.right - left - right) / 2)
		).toBeLessThan(1);
		expect(
			Math.abs((orbital.top + text.bottom - top - bottom) / 2)
		).toBeLessThan(1);
		expect(status.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			bottom + 1
		);
	});
};

const defaultBlock: Story = {
	name: 'Global — default in a block',
	render: (args) => (
		<div data-loading-host style={{ height: '100dvh' }}>
			<Loading {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await assertCentered(canvasElement);
	}
};

export const DefaultBlockDesktop: Story = {
	...defaultBlock,
	name: 'Global — desktop',
	globals: { viewport: { value: 'desktop1440' } }
};

export const DefaultBlockMobile: Story = {
	...defaultBlock,
	name: 'Global — mobile',
	globals: { viewport: { value: 'phone375' } }
};

export const RightPane: Story = {
	name: 'Global — right content pane',
	globals: { viewport: { value: 'desktop1440' } },
	render: (args) => (
		<div data-loading-host style={{ height: '100dvh' }}>
			<StageLayout stage={<Stage hasAnimation={false} isReady />}>
				<Loading {...args} />
			</StageLayout>
		</div>
	),
	play: async ({ canvasElement }) => {
		await assertCentered(canvasElement);
	}
};

export const BoundedSection: Story = {
	name: 'Global — bounded content section',
	render: (args) => (
		<div style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
			<div style={{ height: 64, flexShrink: 0 }} />
			<div
				data-loading-host
				style={{ flex: 1, minHeight: 0, display: 'flex' }}
			>
				<Loading {...args} />
			</div>
			<div style={{ height: 48, flexShrink: 0 }} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await assertCentered(canvasElement);
	}
};

export const TranslatedStatus: Story = {
	args: { layout: 'page' },
	play: async ({ canvasElement }) => {
		const previousLanguage = i18n.language;
		const translations = {
			'de': 'Bitte warten',
			'de@informal': 'Bitte warten',
			'en': 'Please wait',
			'fr': 'Veuillez attendre',
			'ru': 'Пожалуйста, подождите',
			'ti': 'በጃኹም ተጸበዩ።',
			'tr': 'Lütfen bekleyin'
		};
		try {
			for (const [language, text] of Object.entries(translations)) {
				await i18n.changeLanguage(language);
				await waitFor(() =>
					expect(
						within(canvasElement).getByRole('status').textContent
					).toBe(text)
				);
			}
		} finally {
			await i18n.changeLanguage(previousLanguage);
		}
	}
};
