// Minimal vite-based Storybook config for the M3 form components only.
// Temporary: the main .storybook config (webpack5/v7) is mid-migration to
// Storybook 10; this scoped config lets the M3 component stories run in the
// meantime. Start with: npx storybook dev -p 6007 --ci -c .storybook-m3
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
	stories: ['../src/components/form/*.stories.@(ts|tsx)'],
	framework: {
		name: '@storybook/react-vite',
		options: {}
	}
};

export default config;
