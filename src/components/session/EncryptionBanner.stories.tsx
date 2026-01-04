import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EncryptionBanner } from './EncryptionBanner';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

// Initialize i18n for Storybook
i18n.init({
	lng: 'en',
	fallbackLng: 'en',
	resources: {
		en: {
			translation: {
				'e2ee.hint': 'Your messages are encrypted end-to-end. That means no one outside this chat can read the messages. Not even the online consulting platform.'
			}
		}
	}
});

const meta: Meta<typeof EncryptionBanner> = {
	title: 'Components/Chat/EncryptionBanner',
	component: EncryptionBanner,
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<I18nextProvider i18n={i18n}>
				<div style={{ padding: '20px', backgroundColor: '#ffffff' }}>
					<Story />
				</div>
			</I18nextProvider>
		)
	],
	parameters: {
		docs: {
			description: {
				component: 'Element-style encryption status banner displayed at the top of chat sessions. Shows users that their conversation is end-to-end encrypted.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof EncryptionBanner>;

/**
 * Default encryption banner showing E2EE is enabled
 * Displays with green background, lock icon, and informative text
 */
export const Default: Story = {};

/**
 * Banner in a wider container to show responsive max-width
 */
export const WideContainer: Story = {
	decorators: [
		(Story) => (
			<I18nextProvider i18n={i18n}>
				<div style={{ padding: '20px', backgroundColor: '#ffffff', width: '1200px' }}>
					<Story />
				</div>
			</I18nextProvider>
		)
	]
};

/**
 * Banner in a narrow container to show responsive behavior
 */
export const NarrowContainer: Story = {
	decorators: [
		(Story) => (
			<I18nextProvider i18n={i18n}>
				<div style={{ padding: '20px', backgroundColor: '#ffffff', width: '400px' }}>
					<Story />
				</div>
			</I18nextProvider>
		)
	]
};

/**
 * Banner with dark background (to show contrast)
 */
export const DarkBackground: Story = {
	decorators: [
		(Story) => (
			<I18nextProvider i18n={i18n}>
				<div style={{ padding: '20px', backgroundColor: '#1a1a1a' }}>
					<Story />
				</div>
			</I18nextProvider>
		)
	]
};

