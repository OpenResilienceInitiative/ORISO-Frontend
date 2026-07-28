import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductTourTooltip } from './ProductTourTooltip';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import './productTour.styles.scss';

/**
 * Fake Joyride render props so every tooltip state is reviewable in
 * isolation; the positioning itself is covered by the ProductTour stories.
 */
const tooltipProps = (over: Record<string, any> = {}) =>
	({
		index: 1,
		size: 5,
		isLastStep: false,
		continuous: true,
		step: {
			title: 'walkthrough.step.1.title',
			content: 'walkthrough.step.1.intro'
		},
		backProps: { 'onClick': () => {}, 'aria-label': 'back' },
		closeProps: { 'onClick': () => {}, 'aria-label': 'close' },
		primaryProps: { 'onClick': () => {}, 'aria-label': 'next' },
		skipProps: { 'onClick': () => {}, 'aria-label': 'skip' },
		tooltipProps: {},
		controls: {
			next: () => {},
			prev: () => {},
			skip: () => {},
			close: () => {}
		},
		...over
	}) as any;

const meta = {
	title: 'Molecules/ProductTourTooltip',
	component: ProductTourTooltip,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Frontend-styled tooltip for React Joyride product tours. Renders translated step copy, progress, bullets and design-system buttons; all colors come from the --m3-* token variables.'
			}
		}
	}
} satisfies Meta<typeof ProductTourTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {
	args: tooltipProps({
		index: 0,
		step: {
			title: 'walkthrough.step.0.title',
			content: 'walkthrough.step.0.intro'
		}
	})
};

export const MiddleStep: Story = {
	args: tooltipProps({ index: 2 })
};

export const FinalStep: Story = {
	args: tooltipProps({
		index: 4,
		isLastStep: true,
		step: {
			title: 'walkthrough.step.6.title',
			content: 'walkthrough.step.6.intro'
		}
	})
};

export const LongTranslatedCopy: Story = {
	args: tooltipProps({
		step: {
			title: 'walkthrough.step.1.title',
			content: 'walkthrough.step.1.intro'
		}
	}),
	parameters: {
		docs: {
			description: {
				story: 'The longest migrated walkthrough copy: translated text wraps without hiding the navigation actions.'
			}
		}
	}
};

export const English: Story = {
	args: tooltipProps({ index: 0 }),
	globals: { locale: 'en' }
};

export const German: Story = {
	args: tooltipProps({ index: 0 }),
	globals: { locale: 'de' }
};

export const MobileViewport: Story = {
	args: tooltipProps(),
	globals: { viewport: { value: 'mobile1', isRotated: false } }
};

export const TenantThemeTokenProof: Story = {
	args: tooltipProps(),
	decorators: [
		(StoryComponent) => (
			<div
				style={
					{
						'--m3-primary': '#1d4ed8',
						'--m3-on-primary': '#ffffff',
						'--m3-surface': '#f8fafc',
						'--m3-on-surface': '#0f172a',
						'--m3-on-surface-variant': '#475569'
					} as React.CSSProperties
				}
			>
				<StoryComponent />
			</div>
		)
	],
	parameters: {
		docs: {
			description: {
				story: 'Overriding the --m3-* custom properties restyles the tooltip completely — proof that the component consumes tenant theme tokens instead of hardcoded colors.'
			}
		}
	}
};
