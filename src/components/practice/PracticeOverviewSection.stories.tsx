import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import {
	AppConfigContext,
	AUTHORITIES,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { config } from '../../resources/scripts/config';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { PracticeOverviewSection } from '../../practice/PracticeOverviewSection';
import { ScopedProgressFetch } from './practiceStoryHelpers';

interface SectionArgs {
	/** Platform master switch `settings.enableWalkthrough`. */
	platformTours: boolean;
	/** Release flag `releaseToggles.enablePracticeArea`. */
	releaseFlag: boolean;
	/** The counsellor's own tutorial switch: it must not matter. */
	ownSwitch: boolean;
	/** Tenant switch; unset (undefined) counts as on. */
	supervisionEnabled?: boolean;
	completed?: boolean;
}

/** The section wired like the app: settings, user and tenant from context. */
const Wired = ({
	platformTours,
	releaseFlag,
	ownSwitch,
	supervisionEnabled,
	completed
}: SectionArgs) => (
	<ScopedProgressFetch
		progress={
			completed
				? [
						{
							tourId: 'consultant-practice-accept',
							tourVersion: 1,
							surface: 'frontend',
							status: 'completed'
						}
					]
				: []
		}
	>
		<AppConfigContext.Provider
			value={{
				...config,
				enableWalkthrough: platformTours,
				releaseToggles: { enablePracticeArea: releaseFlag }
			}}
		>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'sb-counsellor',
							grantedAuthorities: [
								AUTHORITIES.CONSULTANT_DEFAULT
							],
							isWalkThroughEnabled: ownSwitch
						},
						setUserData: () => undefined,
						reloadUserData: () => Promise.resolve(null)
					} as never
				}
			>
				<TenantContext.Provider
					value={
						{
							tenant: {
								settings:
									supervisionEnabled === undefined
										? {}
										: {
												featureSupervisionEnabled:
													supervisionEnabled
											}
							}
						} as never
					}
				>
					<div className="profile__content" style={{ maxWidth: 960 }}>
						<PracticeOverviewSection />
					</div>
				</TenantContext.Provider>
			</UserDataContext.Provider>
		</AppConfigContext.Provider>
	</ScopedProgressFetch>
);

const meta = {
	title: 'Organisms/PracticeOverviewSection',
	component: Wired,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'The practice cards wired like the app (#1622): shown to counsellors while the platform master switch and the release flag `enablePracticeArea` are on (default off), whatever their personal tutorial switch says. Supervision is hidden when the Träger switched it off.'
			}
		}
	},
	args: {
		platformTours: true,
		releaseFlag: true,
		ownSwitch: false
	},
	globals: { viewport: { value: 'desktop1440', isRotated: false } }
} satisfies Meta<typeof Wired>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SwitchOffStillStarts: Story = {
	name: 'Personal tutorial switch off · desktop',
	play: async ({ canvas }) => {
		await expect(await canvas.findAllByRole('listitem')).toHaveLength(2);
		for (const button of canvas.getAllByRole('button', {
			name: 'Übung starten'
		})) {
			await expect(button).toBeEnabled();
		}
	}
};

export const SupervisionOff: Story = {
	name: 'Supervision switched off · desktop',
	args: { supervisionEnabled: false },
	play: async ({ canvas }) => {
		await expect(await canvas.findAllByRole('listitem')).toHaveLength(1);
		await expect(
			canvas.getByRole('heading', { name: 'Übung: Anfrage annehmen' })
		).toBeVisible();
		await expect(canvas.queryByText(/Supervision/)).toBeNull();
	}
};

export const Completed: Story = {
	name: 'Completed flow · desktop',
	args: { completed: true },
	play: async ({ canvas }) => {
		await expect(await canvas.findByText('Abgeschlossen')).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: 'Noch einmal üben' })
		).toBeVisible();
	}
};

export const ReleaseFlagOff: Story = {
	name: 'Release flag off (default) · hidden',
	args: { releaseFlag: false },
	play: async ({ canvas }) => {
		await expect(canvas.queryByText('Übungsbereich')).toBeNull();
		await expect(canvas.queryByRole('listitem')).toBeNull();
	}
};

export const MasterSwitchOff: Story = {
	name: 'Platform master switch off · hidden',
	args: { platformTours: false },
	play: async ({ canvas }) => {
		await expect(canvas.queryByText('Übungsbereich')).toBeNull();
		await expect(canvas.queryByRole('listitem')).toBeNull();
	}
};
