import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	ActiveSessionContext,
	TenantContext,
	UserDataContext
} from '../globalState';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownHeader
} from '../components/chatMenuDropdown/ChatMenuDropdown';
import {
	ADDON_CONTRACT,
	AddonHostProps,
	AddonModule,
	AddonRegistrationResult,
	AddonRegistryResponse
} from './addonTypes';
import { useAddonRegistry, useAddonRegistryLoader } from './addonRegistry';
import { AddonModuleLoaderContext } from './AddonMount';
import { AddonPage } from './AddonPage';
import { AddonProfileTiles } from './AddonProfileTiles';
import { AddonSessionActions } from './AddonSessionActions';
import { AddonSessionPanel } from './AddonSessionPanel';
import { AddonSessionMenuItems } from './AddonSessionMenuItems';
import { useOpenAddonPanel, withAddonPanel } from './addonPanel';
import { addonNavigationItems } from './addonNavigation';
import { RegistrationAddonStep } from './RegistrationAddonStep';
import { toRegistrationAddon } from './registrationAddon';
import { webKit } from './kit';
import { AddonIconBaseContext } from './AddonIcon';

const registry: AddonRegistryResponse = {
	contract: ADDON_CONTRACT,
	addons: [
		{
			name: 'notes',
			version: '1.0.0',
			entry: '/service/addons/notes/ui/index.js',
			apiBase: '/service/addons/notes/api',
			apps: [
				{
					id: 'journal',
					title: { de: 'Notizen', en: 'Notes' },
					icon: '/service/addons/notes/ui/icons/journal.svg',
					slots: [
						'asker.navigation',
						'consultant.navigation',
						'consultant.session',
						'consultant.asker-profile'
					]
				},
				{
					id: 'goals',
					title: { de: 'Ziele', en: 'Goals' },
					description: {
						de: 'Ziele festhalten und mit der Beratung teilen',
						en: 'Note goals and share them with your counsellor'
					},
					icon: '/service/addons/notes/ui/icons/goals.svg',
					badge: 2,
					slots: [
						'asker.navigation',
						'asker.session-menu',
						'consultant.session-menu'
					]
				},
				{
					id: 'diary',
					title: { de: 'Tagebuch', en: 'Diary' },
					slots: ['asker.navigation', 'asker.session-menu']
				}
			]
		}
	]
};

const notesApp = registry.addons[0].apps[0];

const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});

const NotesForm = ({ slot, sessionId }: AddonHostProps) => {
	const [saved, setSaved] = useState(false);
	return (
		<form
			style={{ display: 'grid', gap: 8, maxWidth: 420 }}
			onSubmit={(event) => {
				event.preventDefault();
				setSaved(true);
			}}
		>
			<label htmlFor={`notes-${slot}`}>Notiz</label>
			<textarea id={`notes-${slot}`} rows={3} />
			<button type="submit">Speichern</button>
			<small>
				{slot}
				{sessionId ? `, session ${sessionId}` : ''}
			</small>
			{saved && <p role="status">Gespeichert</p>}
		</form>
	);
};

const createNotesModule = (): AddonModule => {
	const roots = new Map<HTMLElement, Root>();
	return {
		mount: (props) => {
			const root = createRoot(props.domElement);
			roots.set(props.domElement, root);
			root.render(<NotesForm {...props} />);
		},
		unmount: (props) => {
			roots.get(props.domElement)?.unmount();
			roots.delete(props.domElement);
		}
	};
};

const { Provider, RadioGroup, Button, Notice } = webKit;

// What a `registration.agency-finder` app could ask, built from the web kit like a real bundle.
const FinderForm = ({ topicId, postcode, complete, back }: AddonHostProps) => {
	const [agency, setAgency] = useState('');
	return (
		<Provider>
			<form
				style={{ display: 'grid', gap: 16, maxWidth: 520 }}
				onSubmit={(event) => {
					event.preventDefault();
					complete?.({
						agencyId: Number(agency),
						topicId,
						postcode,
						registrationRef: 'finder-answers-17'
					});
				}}
			>
				<Notice title="Passende Beratungsstellen" type="info">
					{`Für Thema ${topicId} in ${postcode}`}
				</Notice>
				<RadioGroup
					label="Welche Beratungsstelle möchten Sie?"
					value={agency}
					onChange={setAgency}
					options={[
						{ value: '12', label: 'Suchtberatung Mitte (online)' },
						{ value: '14', label: 'Fachstelle Nord (vor Ort)' }
					]}
				/>
				<div style={{ display: 'flex', gap: 12 }}>
					<Button variant="secondary" onClick={() => back?.()}>
						Zurück
					</Button>
					<Button type="submit" disabled={!agency}>
						Weiter
					</Button>
				</div>
			</form>
		</Provider>
	);
};

const createFinderModule = (): AddonModule => {
	const roots = new Map<HTMLElement, Root>();
	return {
		mount: (props) => {
			const root = createRoot(props.domElement);
			roots.set(props.domElement, root);
			root.render(<FinderForm {...props} />);
		},
		unmount: (props) => {
			roots.get(props.domElement)?.unmount();
			roots.delete(props.domElement);
		}
	};
};

const workingLoader = (url: string) =>
	Promise.resolve(
		url.includes('/finder/') ? createFinderModule() : createNotesModule()
	);
const brokenLoader = () => Promise.reject(new Error('bundle not reachable'));

const RegistryStub = ({ children }: { children: React.ReactNode }) => {
	const restore = useRef<(() => void) | null>(null);
	if (!restore.current) {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.endsWith('/service/addons/registry')) {
				return json(registry);
			}
			if (url.includes('/service/users/consultants/sessions/')) {
				return json({ askerId: 'asker-7' });
			}
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
		};
	}
	useEffect(() => () => restore.current?.(), []);
	return <>{children}</>;
};

const RegistryLoader = () => {
	useAddonRegistryLoader('sb-user');
	return null;
};

const asker = {
	userId: 'asker-7',
	userName: 'kim',
	userRoles: ['user'],
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
} as any;

const counsellor = {
	userId: 'consultant-3',
	userName: 'beraterin',
	userRoles: ['consultant'],
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
} as any;

const AsUser = ({
	user,
	children
}: {
	user: unknown;
	children: React.ReactNode;
}) => (
	<UserDataContext.Provider
		value={
			{
				userData: user,
				setUserData: () => undefined,
				reloadUserData: async () => null
			} as any
		}
	>
		{children}
	</UserDataContext.Provider>
);

const activeSession = {
	isGroup: false,
	isEnquiry: false,
	item: { id: 41, agencyId: 9 }
} as any;

const meta = {
	title: 'Organisms/Addons',
	tags: ['autodocs'],
	decorators: [
		(Story, context) => (
			<RegistryStub>
				<AddonModuleLoaderContext.Provider
					value={
						context.parameters.addonLoader === 'broken'
							? brokenLoader
							: workingLoader
					}
				>
					<AddonIconBaseContext.Provider value="">
						<ActiveSessionContext.Provider
							value={{
								activeSession,
								reloadActiveSession: () => undefined
							}}
						>
							<RegistryLoader />
							<Story />
						</ActiveSessionContext.Provider>
					</AddonIconBaseContext.Provider>
				</AddonModuleLoaderContext.Provider>
			</RegistryStub>
		)
	],
	parameters: {
		docs: {
			description: {
				component:
					'Add-on apps (ADR-034) mounted into the slots of the web app. The registry ' +
					'and the bundle are stubbed: the bundle is a small inline form.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** An add-on app as its own page, reached from the navigation. */
export const NavigationPage: Story = {
	parameters: { router: { initialPath: '/addons/notes/journal' } },
	render: () => (
		<Routes>
			<Route path="/addons/:addonName/:appId" element={<AddonPage />} />
		</Routes>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole('heading', { name: /Notizen|Notes/ })
		).toBeVisible();
		await userEvent.type(await canvas.findByLabelText('Notiz'), 'Hallo');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Speichern' })
		);
		await expect(await canvas.findByRole('status')).toHaveTextContent(
			'Gespeichert'
		);
	}
};

/** Add-on tiles in the client profile counsellors see. */
export const ProfileTiles: Story = {
	render: () => (
		<div style={{ maxWidth: 420, padding: 16 }}>
			<AddonProfileTiles />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('consultant.asker-profile, session 41')
		).toBeVisible();
	}
};

/** The header action opens the add-on app as side panel of the case view. */
export const CaseViewSidePanel: Story = {
	parameters: { router: { initialPath: '/sessions/41?addon=notes/journal' } },
	render: () => (
		<div style={{ display: 'grid', gap: 16, padding: 16 }}>
			<AddonSessionActions />
			<div style={{ height: 360, maxWidth: 420, display: 'flex' }}>
				<AddonSessionPanel
					addon={registry.addons[0]}
					app={notesApp}
					agencyId={9}
					sessionId={41}
					variant="card"
					onClose={() => undefined}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole('button', {
				name: /Notizen|Notes/,
				pressed: true
			})
		).toBeVisible();
		await expect(
			await canvas.findByText('consultant.session, session 41')
		).toBeVisible();
	}
};

/** A bundle that cannot be loaded leaves a message, the rest of the view keeps working. */
export const BundleFailsToLoad: Story = {
	parameters: {
		addonLoader: 'broken',
		verification: {
			expectedErrors: [
				{
					kind: 'console-error',
					message: 'Add-on notes/journal failed bundle not reachable',
					count: 1
				}
			]
		}
	},
	render: ProfileTiles.render,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('alert')).toBeVisible();
	}
};

/** The chat menu with the session-menu apps and the panel the URL opens beside the chat. */
const SessionMenuWithPanel = ({ role }: { role: 'asker' | 'consultant' }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const open = useOpenAddonPanel(
		location.search,
		{ agencyId: 9, sessionId: 41 },
		role
	);
	return (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 24,
				alignItems: 'flex-start',
				padding: 16
			}}
		>
			<ChatMenuDropdown
				id="flyout"
				className="sessionMenu__content sessionMenu__content--open"
				style={{ position: 'static' }}
				ariaLabel="Chatraum Einstellungen"
			>
				<ChatMenuDropdownHeader
					title="Chatraum Einstellungen"
					subtitle="Für diesen Chat"
				/>
				<ChatMenuDropdownDivider />
				<AddonSessionMenuItems onSelect={() => undefined} />
			</ChatMenuDropdown>
			{open && (
				<div style={{ height: 360, width: 420, display: 'flex' }}>
					<AddonSessionPanel
						{...open}
						agencyId={9}
						sessionId={41}
						variant="card"
						onClose={() =>
							navigate({
								pathname: location.pathname,
								search: withAddonPanel(location.search, null)
							})
						}
					/>
				</div>
			)}
		</div>
	);
};

/**
 * Client: the chat menu lists the apps in `asker.session-menu` with icon, title, description
 * and badge; an app without icon keeps the default one. A click opens it beside the chat.
 */
export const SessionMenuClient: Story = {
	parameters: { router: { initialPath: '/sessions/user/view/session/41' } },
	render: () => (
		<AsUser user={asker}>
			<SessionMenuWithPanel role="asker" />
		</AsUser>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const entry = await canvas.findByRole('button', { name: /Ziele/ });
		await expect(entry).toHaveTextContent(
			/Ziele festhalten und mit der Beratung teilen|Note goals/
		);
		await expect(
			canvas.getByRole('button', { name: /Tagebuch|Diary/ })
		).toBeVisible();
		await userEvent.click(entry);
		await expect(
			await canvas.findByText('asker.session-menu, session 41')
		).toBeVisible();
		await expect(
			canvas.getByRole('heading', { name: /Ziele|Goals/ })
		).toHaveFocus();
	}
};

/** Counsellor: the same entries from `consultant.session-menu`, opened in the case view's panel. */
export const SessionMenuCounsellor: Story = {
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionView/session/41' }
	},
	render: () => (
		<AsUser user={counsellor}>
			<SessionMenuWithPanel role="consultant" />
		</AsUser>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const entry = await canvas.findByRole('button', { name: /Ziele/ });
		await expect(
			canvas.queryByRole('button', { name: /Tagebuch|Diary/ })
		).toBeNull();
		await userEvent.click(entry);
		await expect(
			await canvas.findByText('consultant.session-menu, session 41')
		).toBeVisible();
	}
};

const NavigationIcons = () => {
	const { addons } = useAddonRegistry();
	const location = useLocation();
	const items = addonNavigationItems(addons, 'asker.navigation', 'de');
	return (
		<nav
			aria-label="Add-ons"
			style={{ display: 'flex', gap: 8, padding: 16 }}
		>
			{items.map(({ to, icon: Icon, title }) => {
				const active = location.pathname === to;
				return (
					<a
						key={to}
						href={to}
						aria-current={active ? 'page' : undefined}
						style={{
							display: 'grid',
							justifyItems: 'center',
							gap: 4,
							padding: '8px 12px',
							borderRadius: 16,
							textDecoration: 'none',
							color: active
								? 'var(--m3-on-secondary-container, #1b1b1c)'
								: 'var(--m3-on-surface-variant, #444748)',
							background: active
								? 'var(--m3-secondary-container, #e3e2e6)'
								: 'transparent'
						}}
					>
						<Icon
							className="addonStoryIcon"
							aria-label={title}
							title={title}
						/>
						<span>{title}</span>
					</a>
				);
			})}
		</nav>
	);
};

/**
 * App icons in the navigation and the case view header: drawn as a mask in the text colour, so
 * the active item takes its colour; apps without an icon keep the default tools icon.
 */
export const AppIcons: Story = {
	parameters: { router: { initialPath: '/addons/notes/goals' } },
	render: () => (
		<AsUser user={asker}>
			<style>{'.addonStoryIcon { width: 24px; height: 24px; }'}</style>
			<NavigationIcons />
			<div style={{ padding: 16 }}>
				<AddonSessionActions />
			</div>
		</AsUser>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const active = await canvas.findByRole('link', { name: /Ziele/ });
		await waitFor(() =>
			expect(
				active.querySelector('[data-addon-icon$="goals.svg"]')
			).not.toBeNull()
		);
		await expect(
			canvas
				.getByRole('link', { name: /Tagebuch/ })
				.querySelector('.addonIcon')
		).toBeNull();
		await expect(
			await canvas.findByRole('button', { name: /Notizen|Notes/ })
		).toBeVisible();
	}
};

const finder = toRegistrationAddon({
	contract: ADDON_CONTRACT,
	name: 'finder',
	version: '1.0.0',
	appId: 'finder',
	title: { de: 'Beratungsstelle finden' },
	icon: '/service/addons/finder/ui/icons/finder.svg',
	entry: '/service/addons/finder/ui/entry.js',
	apiBase: '/service/addons/finder/public/api'
})!;

const RegistrationStepDemo = () => {
	const [result, setResult] = useState<AddonRegistrationResult | null>(null);
	const [wentBack, setWentBack] = useState(false);
	return (
		<TenantContext.Provider
			value={
				{
					tenant: { id: 7, name: 'Träger' },
					setTenant: () => undefined,
					updateTenantSettings: () => undefined
				} as any
			}
		>
			<div style={{ maxWidth: 780, padding: 16 }}>
				<RegistrationAddonStep
					{...finder}
					topicId={3}
					postcode="10115"
					onComplete={setResult}
					onBack={() => setWentBack(true)}
				/>
				<output
					data-testid="registration-result"
					style={{ display: 'block', marginTop: 16 }}
				>
					{result
						? `Registrierung geht weiter mit Beratungsstelle ${result.agencyId}, Ref ${result.registrationRef}`
						: wentBack
							? 'Zurück zur Postleitzahl'
							: ''}
				</output>
			</div>
		</TenantContext.Provider>
	);
};

/**
 * `registration.agency-finder`: an add-on replaces the agency selection of the registration.
 * It gets topic and postcode so far and hands back agency and ref with `complete`.
 */
export const RegistrationAgencyFinder: Story = {
	parameters: { router: { initialPath: '/registration/agency-selection' } },
	render: () => <RegistrationStepDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Für Thema 3 in 10115')
		).toBeVisible();
		await userEvent.click(
			canvas.getByLabelText('Suchtberatung Mitte (online)')
		);
		await userEvent.click(canvas.getByRole('button', { name: 'Weiter' }));
		await expect(
			canvas.getByTestId('registration-result')
		).toHaveTextContent(
			'Registrierung geht weiter mit Beratungsstelle 12, Ref finder-answers-17'
		);
	}
};
