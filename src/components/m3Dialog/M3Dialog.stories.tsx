import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { M3Dialog } from './M3Dialog';
import { GdprIcon, ImprintIcon } from '../../resources/img/icons';

/**
 * The Admin panel's standard M3 basic dialog, ported to the frontend. It is the
 * house message box, error box and legal sheet in one component — see
 * `M3Dialog.tsx` for why it exists next to `OrisoDialog`.
 */
const meta = {
	title: 'Molecules/M3Dialog',
	component: M3Dialog,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Standard M3 basic dialog (Design-System M3_ORISO, node 60942-12062): 28px surface-container-high sheet, 32px hero icon, centred headline, scrolling body, divider and right-aligned M3 text buttons. Same anatomy and same `--m3-*` tokens as the Admin panel dialog, so a confirm box, an error box and a legal notice all read as one design.'
			}
		}
	},
	args: {
		open: true,
		onClose: () => undefined
	}
} satisfies Meta<typeof M3Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const LONG_LEGAL_TEXT = Array.from({ length: 12 }, (_, index) => (
	<p key={index} style={{ margin: '0 0 12px' }}>
		Absatz {index + 1}: Platzhaltertext, der lang genug ist, damit der
		Inhaltsbereich scrollt. Titel, Icon und die Aktionen bleiben dabei
		stehen — genau dafür scrollt der Körper und nicht das Blatt.
	</p>
));

/** One action: the plain message box. */
export const Message: Story = {
	args: {
		title: 'Änderungen gespeichert',
		description:
			'Ihre Angaben sind übernommen und sofort für alle Beratenden sichtbar.',
		actions: [
			{ label: 'Schließen', onClick: () => undefined, primary: true }
		]
	}
};

/** Two actions — the shape Frank asked for: neutral dismiss, coloured confirm. */
export const TwoActions: Story = {
	args: {
		title: 'Beratung wirklich beenden?',
		description:
			'Der Verlauf bleibt erhalten. Neue Nachrichten sind danach nicht mehr möglich.',
		children: (
			<p style={{ margin: 0 }}>
				Ratsuchende sehen einen Hinweis, dass die Beratung abgeschlossen
				wurde.
			</p>
		),
		actions: [
			{ label: 'Abbrechen', onClick: () => undefined },
			{ label: 'Beenden', onClick: () => undefined, primary: true }
		]
	}
};

/**
 * The error box. The colour comes from the M3 error role that the generated
 * Oriso scheme owns — never from a red picked by hand.
 */
export const ErrorMessage: Story = {
	args: {
		severity: 'error',
		title: 'Nachricht konnte nicht gesendet werden',
		description:
			'Die Verbindung wurde unterbrochen, bevor die Nachricht verschlüsselt abgelegt werden konnte.',
		children: (
			<p style={{ margin: 0 }}>
				Ihr Text ist nicht verloren — er steht weiterhin im Eingabefeld
				und kann erneut gesendet werden.
			</p>
		),
		actions: [
			{ label: 'Abbrechen', onClick: () => undefined },
			{ label: 'Erneut senden', onClick: () => undefined, primary: true }
		]
	}
};

/** A published legal text is far longer than a confirm sentence — it scrolls. */
export const ScrollingLegalText: Story = {
	args: {
		icon: <GdprIcon />,
		title: 'Datenschutzerklärung',
		children: LONG_LEGAL_TEXT,
		actions: [
			{ label: 'Schließen', onClick: () => undefined, primary: true }
		]
	}
};

/** The footer entry on the login stage: platform-level imprint. */
export const Imprint: Story = {
	args: {
		icon: <ImprintIcon />,
		title: 'Impressum',
		children: (
			<>
				<p style={{ margin: '0 0 12px' }}>
					Sie sind hier noch bei keiner Beratungsstelle angemeldet —
					dieser Hinweis gilt für die Plattform selbst.
				</p>
				<p style={{ margin: 0 }}>
					Die Beratung leisten eigenständige Beratungsstellen mit
					eigenen Angaben; die sehen Sie, sobald Sie eine gewählt
					haben.
				</p>
			</>
		),
		actions: [
			{ label: 'Schließen', onClick: () => undefined, primary: true }
		]
	}
};

/** Two short actions stay a right-aligned row on mobile; three or more stack. */
export const Mobile: Story = {
	parameters: { viewport: { defaultViewport: 'mobile1' } },
	args: {
		icon: <GdprIcon />,
		title: 'Datenschutzerklärung',
		children: LONG_LEGAL_TEXT,
		actions: [
			{ label: 'Zurück', onClick: () => undefined },
			{ label: 'Verstanden', onClick: () => undefined, primary: true }
		]
	}
};

/** No hero icon and no divider — the minimal sheet. */
export const Bare: Story = {
	args: {
		title: 'Kurzer Hinweis',
		showDivider: false,
		children: <p style={{ margin: 0 }}>Nichts weiter zu tun.</p>,
		actions: [{ label: 'OK', onClick: () => undefined, primary: true }]
	}
};
