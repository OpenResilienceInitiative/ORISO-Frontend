import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Route, Routes } from 'react-router-dom';
import { expect, userEvent, within } from 'storybook/test';
import { ActiveSessionContext } from '../globalState';
import {
	ADDON_CONTRACT,
	AddonHostProps,
	AddonModule,
	AddonRegistryResponse
} from './addonTypes';
import { useAddonRegistryLoader } from './addonRegistry';
import { AddonModuleLoaderContext } from './AddonMount';
import { AddonPage } from './AddonPage';
import { AddonProfileTiles } from './AddonProfileTiles';
import { AddonSessionActions } from './AddonSessionActions';
import { AddonSessionPanel } from './AddonSessionPanel';

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
					slots: [
						'asker.navigation',
						'consultant.navigation',
						'consultant.session',
						'consultant.asker-profile'
					]
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

const workingLoader = () => Promise.resolve(createNotesModule());
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
					<ActiveSessionContext.Provider
						value={{
							activeSession,
							reloadActiveSession: () => undefined
						}}
					>
						<RegistryLoader />
						<Story />
					</ActiveSessionContext.Provider>
				</AddonModuleLoaderContext.Provider>
			</RegistryStub>
		)
	],
	parameters: {
		docs: {
			description: {
				component:
					'Add-on apps (ADR-032) mounted into the slots of the web app. The registry ' +
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
