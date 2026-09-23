import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { expect, userEvent, waitFor } from 'storybook/test';
import { Profile } from './Profile';
import {
	AppConfigContext,
	AUTHORITIES,
	ConsultingTypesContext,
	UserDataContext
} from '../../globalState';
import { config } from '../../resources/scripts/config';
import { consultantWalkthroughTour } from '../productTour/tourDefinitions';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

type ProgressFixture = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'surface' | 'status'
>[];

interface StageOptions {
	/** Platform master switch (`settings.enableWalkthrough`). */
	platformTours?: boolean;
	/** The counsellor's own switch (`userData.isWalkThroughEnabled`). */
	ownSwitch?: boolean;
	progress?: ProgressFixture;
}

const counsellor = (isWalkThroughEnabled: boolean) => ({
	userId: 'sb-counsellor',
	userName: 'mara.berger',
	firstName: 'Mara',
	lastName: 'Berger',
	displayName: 'Mara Berger',
	email: 'mara.berger@example.org',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	languages: ['de'],
	isWalkThroughEnabled,
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
});

const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});

/**
 * Serves the two calls the Tours area makes — the versioned progress read and
 * the switch PATCH — so the switch round-trips like on Dev. Installed during
 * render because the carousel fetches in an effect that runs before ours.
 */
const StubbedToursApi = ({
	options,
	children
}: {
	options: StageOptions;
	children: (
		ownSwitch: boolean,
		reload: () => Promise<unknown>
	) => React.ReactNode;
}) => {
	const [ownSwitch, setOwnSwitch] = useState(!!options.ownSwitch);
	const server = useMemo(() => ({ ownSwitch: !!options.ownSwitch }), []); // eslint-disable-line react-hooks/exhaustive-deps

	const restore = useMemo(() => {
		const realFetch = window.fetch;
		window.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const url = String(
				typeof input === 'string' || input instanceof URL
					? input
					: input.url
			);
			// fetchData passes a Request, so method and body live on it.
			const request = new Request(input, init);
			if (url.includes('/service/users/tutorials/progress')) {
				return json(options.progress ?? []);
			}
			if (
				url.includes('/service/users/data') &&
				request.method === 'PATCH'
			) {
				const body = JSON.parse((await request.text()) || '{}');
				server.ownSwitch = !!body.walkThroughEnabled;
				return json({});
			}
			return realFetch(input as RequestInfo, init);
		}) as typeof window.fetch;
		return () => {
			window.fetch = realFetch;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => restore, [restore]);

	const reload = useCallback(async () => {
		setOwnSwitch(server.ownSwitch);
		return null;
	}, [server]);

	return <>{children(ownSwitch, reload)}</>;
};

const renderStage = (options: StageOptions) => () => (
	<StubbedToursApi options={options}>
		{(ownSwitch, reload) => (
			<AppConfigContext.Provider
				value={{
					...config,
					enableWalkthrough: options.platformTours ?? true
				}}
			>
				<ConsultingTypesContext.Provider
					value={{
						consultingTypes: [],
						setConsultingTypes: () => {}
					}}
				>
					<UserDataContext.Provider
						value={
							{
								userData: counsellor(ownSwitch),
								setUserData: () => undefined,
								reloadUserData: reload
							} as never
						}
					>
						<div style={{ height: '100vh' }}>
							<Routes>
								<Route
									path="/profile/*"
									element={<Profile />}
								/>
							</Routes>
						</div>
					</UserDataContext.Provider>
				</ConsultingTypesContext.Provider>
			</AppConfigContext.Provider>
		)}
	</StubbedToursApi>
);

const desktop = {
	globals: { viewport: { value: 'desktop1440', isRotated: false } },
	parameters: { router: { initialPath: '/profile/hilfe' } }
};

const phone = (path: string) => ({
	globals: { viewport: { value: 'phone390', isRotated: false } },
	parameters: { router: { initialPath: path } }
});

/**
 * Profile → Help → Tours, wired exactly like the app: the real `Profile`
 * page, the real Help routes and the real switch and tour list. Only the
 * two backend calls are stubbed.
 */
const meta = {
	title: 'Organisms/HelpTours',
	component: Profile,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'Each counsellor decides for themselves whether product tours start on their own (#1526). The switch lives under Profile → Help → Tours and is **off by default**. Off only stops the automatic start: the tour list next to it stays visible and starts every tour by hand ("disable, don\'t hide"). On, a tour starts on its own once per tour version, and not again after it was completed or skipped. The platform switch `enableWalkthrough` still gates everything: off, the Tours area is gone.'
			}
		}
	}
} satisfies Meta<typeof Profile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OffByDefault: Story = {
	name: 'Off (default) · desktop',
	...desktop,
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas }) => {
		const toggle = await canvas.findByRole('switch', {
			name: 'Rundgang deaktiviert'
		});
		await expect(toggle).not.toBeChecked();
		await expect(
			canvas.getByText(/Rundgänge starten nicht von selbst/)
		).toBeVisible();
		// Disable, don't hide: the list stays and starts tours by hand.
		const startButtons = await canvas.findAllByRole('button', {
			name: 'Starten'
		});
		for (const button of startButtons) {
			await expect(button).toBeEnabled();
		}
	}
};

export const SwitchingOn: Story = {
	name: 'Switching on · desktop',
	...desktop,
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole('switch', { name: 'Rundgang deaktiviert' })
		);
		await waitFor(() =>
			expect(
				canvas.getByRole('switch', { name: 'Rundgang aktiv' })
			).toBeChecked()
		);
	}
};

export const On: Story = {
	name: 'On · desktop',
	...desktop,
	render: renderStage({ ownSwitch: true }),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole('switch', { name: 'Rundgang aktiv' })
		).toBeChecked();
	}
};

export const OnWithCompletedTour: Story = {
	name: 'On, intro tour already completed · desktop',
	...desktop,
	render: renderStage({
		ownSwitch: true,
		progress: [
			{
				tourId: consultantWalkthroughTour.id,
				tourVersion: consultantWalkthroughTour.version,
				surface: 'frontend',
				status: 'completed'
			}
		]
	}),
	parameters: {
		...desktop.parameters,
		docs: {
			description: {
				story: 'The completed intro does not start again on its own. The list offers "Neu starten" instead.'
			}
		}
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByText('Abgeschlossen')
		).toBeInTheDocument();
	}
};

export const PlatformSwitchOff: Story = {
	name: 'Platform switch off · desktop',
	...desktop,
	render: renderStage({ platformTours: false, ownSwitch: true }),
	play: async ({ canvas }) => {
		await canvas.findByRole('tab', { name: 'Hilfe' });
		await expect(canvas.queryByRole('switch')).toBeNull();
		await expect(canvas.queryByText('Meine Rundgänge')).toBeNull();
	}
};

export const PhoneHelpMenu: Story = {
	name: 'Help menu · phone 390',
	...phone('/profile/hilfe'),
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole('link', { name: /Rundgänge/ })
		).toBeVisible();
	}
};

export const PhoneOff: Story = {
	name: 'Off (default) · phone 390',
	...phone('/profile/hilfe/rundgaenge'),
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole('switch', { name: 'Rundgang deaktiviert' })
		).not.toBeChecked();
	}
};

export const PhoneOn: Story = {
	name: 'On · phone 390',
	...phone('/profile/hilfe/rundgaenge'),
	render: renderStage({ ownSwitch: true }),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole('switch', { name: 'Rundgang aktiv' })
		).toBeChecked();
	}
};
