import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { DpaSign } from './DpaSign';

const PREVIEW = {
	tenantName: 'Caritasverband Musterstadt e. V.',
	dpaVersion: '2026-07-20T12:30:00',
	content: JSON.stringify({
		de: '<h2>Auftragsverarbeitungsvertrag</h2><p>Platzhalter — der veröffentlichte AVV-Text des Betreibers wird hier unverändert angezeigt.</p><h3>1. Gegenstand</h3><p>Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich weisungsgebunden.</p>',
		en: '<h2>Data processing agreement</h2><p>Placeholder — the operator’s published DPA text is rendered here unchanged.</p>'
	}),
	expiresAt: '2026-08-03T12:30:00'
};

/**
 * Serves the sign-link preview without a backend. The page talks to plain
 * `fetch`, so the story swaps it for the duration of the story instead of
 * pulling a mocking framework into the build.
 */
const withStubbedApi = (Story: React.ComponentType) => {
	const realFetch = window.fetch;
	window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(
			typeof input === 'string' || input instanceof URL
				? input
				: input.url
		);
		// Preview and confirm share one path and differ only by method.
		if (url.includes('/public/dpa/confirm/')) {
			const body =
				(init?.method ?? 'GET').toUpperCase() === 'POST'
					? { status: 'SIGNED' }
					: PREVIEW;
			return new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}
		return realFetch(input as RequestInfo, init);
	}) as typeof window.fetch;

	return <Story />;
};

/**
 * Public DPA/AVV signing page reached through a single-use e-mail link
 * (`/dpa-sign/:token`).
 *
 * The organisation is stated, never asked for (#879): the link is scoped to
 * exactly one Träger, so the fourth signer slot is a free optional note —
 * the same shape the admin panel's shared signer block uses since
 * ORISO-Admin#608.
 */
const meta = {
	title: 'Pages/DpaSign',
	component: DpaSign,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/dpa-sign/story-token' }
	},
	decorators: [withStubbedApi],
	render: () => (
		<Routes>
			<Route path="/dpa-sign/:token" element={<DpaSign />} />
		</Routes>
	)
} satisfies Meta<typeof DpaSign>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop: contract on the left, signer confirmation on the right. */
export const Desktop: Story = {};

/** 390x844 — the two columns stack, every label stays fully readable. */
export const Mobile: Story = {
	parameters: {
		...meta.parameters,
		viewport: { defaultViewport: 'mobile1' }
	}
};
