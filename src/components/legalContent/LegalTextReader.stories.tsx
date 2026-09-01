import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegalTextReader } from './LegalTextReader';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { GdprIcon } from '../../resources/img/icons';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * The reading surface for a published legal text — the frontend counterpart of
 * the Admin panel's read-only rich-text card: chapter chips, in-place
 * scrolling, fullscreen.
 *
 * The sample below is a chaptered placeholder privacy policy in the shape the
 * Admin's editor produces (`<h2>` per chapter), long enough that scrolling and
 * the chapter row both matter.
 */
const meta = {
	title: 'Molecules/Legal text reader',
	component: LegalTextReader,
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof LegalTextReader>;

export default meta;
type Story = StoryObj<typeof meta>;

const CHAPTERS: [string, string[]][] = [
	[
		'1. Wer für diese Plattform verantwortlich ist',
		[
			'Verantwortlich für den Betrieb der Plattform ist [Name, Rechtsform, Anschrift]. Die datenschutzbeauftragte Stelle erreichen Sie unter [Name, Kontakt].',
			'Zuständige Aufsichtsbehörde ist [Name und Anschrift der Aufsichtsbehörde].'
		]
	],
	[
		'2. Verschiedene Beratungsangebote, verschiedene Verantwortliche',
		[
			'Auf der Plattform gibt es verschiedene Beratungsangebote und Fachbereiche. Die Beratung leisten eigenständige Träger und deren Beratungsstellen.',
			'Die Daten Ihrer Beratung verarbeiten diese überwiegend selbst und in eigener Verantwortung. Der Plattformbetreiber stellt die Technik bereit, betreibt sie und übernimmt die Weiterleitung beziehungsweise Vermittlung Ihrer Anfrage.',
			'Wo beide gemeinsam über Zwecke und Mittel entscheiden, geschieht das in gemeinsamer Verantwortlichkeit; wer welche Pflicht erfüllt, regelt die Vereinbarung zwischen Plattformbetreiber und Träger.'
		]
	],
	[
		'3. Welche Daten bei der Anmeldung verarbeitet werden',
		[
			'Zum Anmelden verarbeiten wir nur, was dafür nötig ist: den von Ihnen gewählten Namen, ein Passwort und — falls Sie eine hinterlegen — eine E-Mail-Adresse für die Wiederherstellung.',
			'Eine E-Mail-Adresse ist freiwillig. Ohne sie können wir Ihnen allerdings kein neues Passwort schicken.'
		]
	],
	[
		'4. Inhalte Ihrer Beratung',
		[
			'Ihre Nachrichten sind Ende-zu-Ende verschlüsselt: lesbar werden sie nur auf Ihrem Gerät und bei Ihrer Beratungsstelle.',
			'Beratungsinhalte kann der Plattformbetreiber technisch nicht einsehen. Das gilt auch für Dateien, die Sie im Beratungsverlauf hochladen.'
		]
	],
	[
		'5. Speicherdauer',
		[
			'Wie lange die Inhalte Ihrer Beratung gespeichert werden, legt Ihre Beratungsstelle fest und beschreibt es in ihrer eigenen Datenschutzerklärung.',
			'Technische Protokolle des Plattformbetriebs werden nach [Frist] gelöscht.'
		]
	],
	[
		'6. Empfänger und Auftragsverarbeiter',
		[
			'Für Hosting und Betrieb setzen wir [Name des Hosting-Betreibers] ein, für Entwicklung und Support [Name des Dienstleisters]. Mit beiden bestehen Auftragsverarbeitungsvereinbarungen; der Verarbeitungsort ist [Land].',
			'Eine Übermittlung in ein Drittland findet nicht statt.'
		]
	],
	[
		'7. Ihre Rechte',
		[
			'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, sich bei der Aufsichtsbehörde zu beschweren.',
			'Wenden Sie sich dafür an [Kontaktweg für Betroffenenanfragen]. Auskunft über die Inhalte Ihrer Beratung erteilt Ihre Beratungsstelle, weil nur sie diese lesen kann.'
		]
	],
	[
		'8. Änderungen dieser Datenschutzerklärung',
		[
			'Wir passen diesen Text an, wenn sich die Verarbeitung ändert. Die jeweils geltende Fassung finden Sie immer an dieser Stelle.'
		]
	]
];

const SAMPLE_POLICY = [
	'<h1>Datenschutzerklärung der Plattform</h1>',
	'<p>Platzhalter: Dies ist noch nicht die veröffentlichte Datenschutzerklärung.</p>',
	...CHAPTERS.map(
		([heading, paragraphs]) =>
			`<h2>${heading}</h2>${paragraphs.map((text) => `<p>${text}</p>`).join('')}`
	)
].join('');

/** The reader on its own, as a page would host it. */
export const Standalone: Story = {
	args: {
		content: SAMPLE_POLICY,
		label: 'Datenschutzerklärung'
	},
	render: (args) => (
		<div style={{ maxWidth: 760, height: '100vh', overflowY: 'auto' }}>
			<LegalTextReader {...args} />
		</div>
	)
};

/** How a help-seeker actually meets it: inside the legal dialog. */
export const InDialog: Story = {
	args: {
		content: SAMPLE_POLICY,
		label: 'Datenschutzerklärung'
	},
	render: (args) => (
		<M3Dialog
			title="Datenschutzerklärung"
			icon={<GdprIcon />}
			width={760}
			closeLabel="Schließen"
			onClose={() => undefined}
			actions={[
				{ label: 'Zurück', onClick: () => undefined },
				{
					label: 'Verstanden',
					onClick: () => undefined,
					primary: true
				}
			]}
		>
			<LegalTextReader {...args} />
		</M3Dialog>
	)
};

/** The case the chapter row exists for — a long document on a phone. */
export const InDialogMobile: Story = {
	...InDialog,
	globals: phone390Globals
};

/** Fewer than two chapters is a label, not a navigation: no chip row. */
export const WithoutChapters: Story = {
	args: {
		content:
			'<p>Ein kurzer Hinweis ohne Überschriften. Hier gibt es nichts zu navigieren, also erscheint auch keine Kapitelzeile.</p>',
		label: 'Kurzer Hinweis'
	},
	render: (args) => (
		<div style={{ maxWidth: 560 }}>
			<LegalTextReader {...args} />
		</div>
	)
};
