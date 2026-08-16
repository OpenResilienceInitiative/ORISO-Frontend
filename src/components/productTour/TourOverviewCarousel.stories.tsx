import type { Meta, StoryObj } from '@storybook/react-vite';
import { TourOverviewCarousel } from './TourOverviewCarousel';
import {
	consultantMailCounsellingTour,
	consultantWalkthroughTour
} from './tourDefinitions';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';
import type { TourDefinition } from './types';
import './productTour.styles.scss';

const secondTour: TourDefinition = {
	...consultantWalkthroughTour,
	id: 'archive-deep-dive',
	titleKey: 'walkthrough.step.4.title',
	summaryKey: 'walkthrough.step.4.intro'
};

const thirdTour: TourDefinition = {
	...consultantWalkthroughTour,
	id: 'profile-deep-dive',
	titleKey: 'walkthrough.step.6.title',
	summaryKey: 'walkthrough.step.6.intro'
};

type ProgressFixture = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'status' | 'currentStepId'
>[];

const meta = {
	title: 'Organisms/TourOverviewCarousel',
	component: TourOverviewCarousel,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Profile overview of the tutorials available to the signed-in user: versioned progress state and a Start/Continue/Restart action per tour, backed by the versioned UserService progress API.'
			}
		}
	},
	args: {
		tours: [consultantWalkthroughTour],
		audience: 'consultant',
		loadProgress: () => Promise.resolve([]),
		onStartTour: () => {}
	}
} satisfies Meta<typeof TourOverviewCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotStarted: Story = {};

export const BothConsultantTours: Story = {
	args: {
		tours: [consultantWalkthroughTour, consultantMailCounsellingTour],
		loadProgress: () =>
			Promise.resolve([
				{
					tourId: consultantWalkthroughTour.id,
					tourVersion: consultantWalkthroughTour.version,
					status: 'completed',
					currentStepId: undefined
				}
			] satisfies ProgressFixture)
	},
	parameters: {
		docs: {
			description: {
				story: 'The shipped consultant catalog: the completed legacy walkthrough offers a restart while the new Mail-Beratung tour (TOUR-10) is offered as not started.'
			}
		}
	}
};

export const MixedStatuses: Story = {
	args: {
		tours: [consultantWalkthroughTour, secondTour, thirdTour],
		loadProgress: () =>
			Promise.resolve<ProgressFixture>([
				{
					tourId: 'consultant-walkthrough',
					tourVersion: 1,
					status: 'completed'
				},
				{
					tourId: 'archive-deep-dive',
					tourVersion: 1,
					status: 'in_progress',
					currentStepId: 'archive'
				}
			])
	}
};

export const NewTourVersionOffersRestartAsFresh: Story = {
	args: {
		tours: [{ ...consultantWalkthroughTour, version: 2 }],
		loadProgress: () =>
			Promise.resolve<ProgressFixture>([
				{
					tourId: 'consultant-walkthrough',
					tourVersion: 1,
					status: 'completed'
				}
			])
	},
	parameters: {
		docs: {
			description: {
				story: 'A newer tour version is a fresh progress scope: the completed v1 progress does not mark v2 as completed.'
			}
		}
	}
};

export const Empty: Story = {
	args: {
		tours: [],
		loadProgress: () => Promise.resolve([])
	}
};

export const MobileViewport: Story = {
	args: {
		tours: [consultantWalkthroughTour, secondTour, thirdTour],
		loadProgress: () =>
			Promise.resolve<ProgressFixture>([
				{
					tourId: 'consultant-walkthrough',
					tourVersion: 1,
					status: 'skipped'
				}
			])
	},
	globals: { viewport: { value: 'mobile1', isRotated: false } }
};
