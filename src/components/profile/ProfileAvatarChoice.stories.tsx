import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { ConsultingTypesContext } from '../../globalState/provider/ConsultingTypesProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import { Profile } from './Profile';

/**
 * #878 phase 4 (US#1240): the avatar row in the profile header, on the real
 * Profile page. The stage answers `PATCH /users/data` like the backend does
 * and hands the stored value back on reload, so a pick survives like in the app.
 */

const asker = {
	userId: 'storybook-asker',
	userName: 'elster_linden_1908',
	userRoles: ['user'],
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	twoFactorAuth: { isEnabled: false, isActive: false },
	consultingTypes: {},
	agencies: []
};

const consultant = {
	userId: 'storybook-consultant',
	userName: 'counsellor.example',
	firstName: 'Kim',
	lastName: 'Beispiel',
	userRoles: ['consultant'],
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	twoFactorAuth: { isEnabled: true, isActive: true, type: 'APP' },
	languages: ['de'],
	agencies: []
};

const StatefulStage = ({
	initial,
	children
}: {
	initial: Record<string, unknown>;
	children: React.ReactNode;
}) => {
	const [userData, setUserData] = useState(initial);
	const stored = useRef<Record<string, unknown>>({});

	useEffect(() => {
		const original = globalThis.fetch;
		globalThis.fetch = async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			// fetchData hands over a Request, so method and body live on it.
			const request = input instanceof Request ? input : null;
			const url = String(request ? request.url : input);
			const method = (
				init?.method ||
				request?.method ||
				'GET'
			).toUpperCase();
			if (/\/users\/data$/.test(url) && method === 'PATCH') {
				const body = init?.body ?? (await request?.clone().text());
				const patch = JSON.parse(String(body));
				// Like the backend: an empty id clears, INITIALS drops a motif.
				stored.current = {
					...stored.current,
					...patch,
					avatarId: patch.avatarId || null
				};
				return new Response('{}', {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return original(input, init);
		};
		return () => {
			globalThis.fetch = original;
		};
	}, []);

	const reloadUserData = useCallback(() => {
		const next = { ...userData, ...stored.current };
		setUserData(next);
		return Promise.resolve(next);
	}, [userData]);
	const value = useMemo(
		() => ({ userData, reloadUserData, setUserData }),
		[userData, reloadUserData]
	);

	return (
		<UserDataContext.Provider value={value as never}>
			<ConsultingTypesContext.Provider
				value={{ consultingTypes: [], setConsultingTypes: () => {} }}
			>
				<SessionsDataContext.Provider
					value={{ sessions: [], ready: true, dispatch: () => {} }}
				>
					<ModalProvider>{children}</ModalProvider>
				</SessionsDataContext.Provider>
			</ConsultingTypesContext.Provider>
		</UserDataContext.Provider>
	);
};

const withStage =
	(userData: Record<string, unknown>) => (Story: React.ComponentType) => (
		<StatefulStage initial={userData}>
			<Story />
		</StatefulStage>
	);

const ProfilePage = () => (
	<div className="app" style={{ minHeight: '100dvh' }}>
		<Routes>
			<Route path="/profile/*" element={<Profile />} />
		</Routes>
	</div>
);

const meta = {
	title: 'Pages/Profile avatar choice',
	component: ProfilePage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/profile/allgemeines' }
	}
} satisfies Meta<typeof ProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;

const desktop1440 = { viewport: { value: 'desktop1440' } };
const phone390 = { viewport: { value: 'phone390' } };

const pickAndKeep = async (canvasElement: HTMLElement, name: string) => {
	const canvas = within(canvasElement);
	const row = await canvas.findByRole('radiogroup', { name: 'Ihr Bild' });
	await expect(
		within(row).getByRole('radio', { name: 'Standard' })
	).toHaveAttribute('aria-checked', 'true');
	await userEvent.click(within(row).getByRole('radio', { name }));
	await waitFor(() =>
		expect(within(row).getByRole('radio', { name })).toHaveAttribute(
			'aria-checked',
			'true'
		)
	);
};

export const AdviceSeeker1440: Story = {
	decorators: [withStage(asker)],
	globals: desktop1440,
	play: ({ canvasElement }) => pickAndKeep(canvasElement, 'fox')
};

export const Counsellor1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	play: ({ canvasElement }) => pickAndKeep(canvasElement, 'magpie')
};

/** A stored motif is preselected; the default tile clears it again. */
export const CounsellorWithMotif1440: Story = {
	decorators: [
		withStage({ ...consultant, avatarKind: 'ICON', avatarId: 'owl' })
	],
	globals: desktop1440
};

export const AdviceSeeker390: Story = {
	decorators: [withStage(asker)],
	globals: phone390,
	parameters: { router: { initialPath: '/profile' } }
};
