import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { DpaSign } from './DpaSign';

/**
 * A short two-paragraph placeholder made every chapter fit on screen at once
 * — which never happens with a real AVV, and is exactly the reason #1163
 * exists (a real one is annexes deep and gets scrolled by hand). Six
 * chapters of realistic clause text is long enough to force the same
 * scrollable-preview overflow a signer actually hits.
 */
const LONG_DE = [
	[
		'1. Gegenstand und Dauer',
		'Gegenstand dieser Vereinbarung ist die Verarbeitung personenbezogener Daten im Auftrag im Rahmen der Nutzung der Online-Beratungsplattform durch den Auftraggeber. Die Vereinbarung gilt für die Dauer der Hauptvereinbarung und endet nicht automatisch mit deren Beendigung, solange noch personenbezogene Daten beim Auftragnehmer vorgehalten werden.'
	],
	[
		'2. Art und Zweck der Verarbeitung',
		'Die Verarbeitung umfasst insbesondere das Erheben, Speichern, Übermitteln und Löschen von Bestands- und Nutzungsdaten Ratsuchender sowie Fachkräfte, soweit dies zur Bereitstellung der Beratungsplattform erforderlich ist. Eine Verarbeitung zu anderen als den hier genannten Zwecken erfolgt nicht.'
	],
	[
		'3. Pflichten des Auftragnehmers',
		'Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung des Auftraggebers, soweit er nicht durch das Recht der Union oder der Mitgliedstaaten hierzu verpflichtet ist. Er stellt sicher, dass zur Verarbeitung befugte Personen zur Vertraulichkeit verpflichtet wurden.'
	],
	[
		'4. Technische und organisatorische Maßnahmen',
		'Der Auftragnehmer trifft die in Anlage 2 aufgeführten technischen und organisatorischen Maßnahmen, um ein dem Risiko angemessenes Schutzniveau zu gewährleisten. Änderungen an den Maßnahmen, die das vereinbarte Schutzniveau unterschreiten, bedürfen der vorherigen Zustimmung des Auftraggebers.'
	],
	[
		'5. Unterauftragsverhältnisse',
		'Die Einbeziehung weiterer Auftragsverarbeiter bedarf der vorherigen schriftlichen oder dokumentierten Genehmigung des Auftraggebers. Eine Übersicht der zum Zeitpunkt des Vertragsschlusses eingesetzten Subunternehmer ist dieser Vereinbarung als Anlage 3 beigefügt.'
	],
	[
		'6. Kontrollrechte des Auftraggebers',
		'Der Auftraggeber ist berechtigt, sich vor Beginn der Datenverarbeitung und danach regelmäßig von der Einhaltung der beim Auftragnehmer getroffenen technischen und organisatorischen Maßnahmen zu überzeugen. Der Auftragnehmer verpflichtet sich, dem Auftraggeber die dafür erforderlichen Auskünfte zu erteilen.'
	]
]
	.map(([heading, body]) => `<h2>${heading}</h2><p>${body}</p>`)
	.join('');

const PREVIEW = {
	tenantName: 'Caritasverband Musterstadt e. V.',
	dpaVersion: '2026-07-20T12:30:00',
	content: JSON.stringify({
		de: LONG_DE,
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
