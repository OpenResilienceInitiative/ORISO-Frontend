import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as BellOffIcon } from '../../resources/img/icons/bell-off.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as PackageIcon } from '../../resources/img/icons/documents.svg';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	ChatMenuDropdownSection
} from './ChatMenuDropdown';

const meta: Meta<typeof ChatMenuDropdown> = {
	title: 'Components/Chat/MenuDropdown',
	component: ChatMenuDropdown,
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'Reusable ORISO chat menu matching the App.Oriso Figma menu surface. ' +
					'Used for chat/session action dropdowns. #597: panel uses ' +
					'`2px solid var(--m3-primary-container)` via `list-item-active-menu-border`.'
			}
		},
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7086-57446'
		}
	},
	args: {
		ariaLabel: 'Chatraum Einstellungen'
	}
};

export default meta;

type Story = StoryObj<typeof ChatMenuDropdown>;

const FigmaMenuItems = ({ activeFirst = false }: { activeFirst?: boolean }) => (
	<ChatMenuDropdown ariaLabel="Chatraum Einstellungen">
		<ChatMenuDropdownHeader
			subtitle="Jeder Raum individuell anpassbar"
			title="Chatraum Einstellungen"
		/>
		<ChatMenuDropdownDivider />
		<ChatMenuDropdownSection>
			<ChatMenuDropdownItem
				icon={<ArchiveIcon />}
				title="Lösche Account"
				description="DerAccount wird in 48h unwiderruflich gelöscht."
				shortcut="⇧A"
				active={activeFirst}
			/>
			<ChatMenuDropdownItem
				icon={<BellOffIcon />}
				title="Stummschalten"
				description="Deaktiviere Benachrichtigungen für diesen Chat."
				shortcut="⇧Ö"
			/>
			<ChatMenuDropdownItem
				icon={<HelpIcon />}
				title="Hilfe Anfragen"
				description="Eskaliere den Fall intern oder extern ohne den Datenschutz zu vernachlässigen."
				shortcut="⇧Ä"
				disabled
			/>
		</ChatMenuDropdownSection>
		<ChatMenuDropdownDivider />
		<ChatMenuDropdownSection>
			<ChatMenuDropdownItem
				icon={<PlusIcon />}
				title="Weitere Personen einladen"
				description="Wer eingeladen werden kann, hängt von den Admin-Einstellungen ab."
				shortcut="⇧I"
				disabled
			/>
			<ChatMenuDropdownItem
				icon={<PackageIcon />}
				title="Chat Zusammenfassen"
				description="Spare Zeit, mit Hilfe unseres vollends Datenschutzkonformen KI Workflows."
				shortcut="⇧Ü"
				disabled
			/>
		</ChatMenuDropdownSection>
	</ChatMenuDropdown>
);

/**
 * The Figma frame as drawn, including the items that are still parked. Kept as
 * the design reference only — FE#781: Mute / Invite / Summarize have no shipped
 * feature behind them, so the real session-list menu omits them entirely rather
 * than rendering them disabled. See `ShippedSessionListMenu` for what users get.
 */
export const FigmaReference: Story = {
	render: () => <FigmaMenuItems />
};

export const ActiveState: Story = {
	render: () => <FigmaMenuItems activeFirst />
};

/**
 * FE#781 — the Chatroom Settings menu as it actually ships on a consultant's
 * active session: every entry resolves to a real handler. "Hilfe Anfragen"
 * opens the Team-Besprechung side room (ADR-016) and is shown on open enquiries
 * (or on accepted sessions that already have a discussion to re-read).
 *
 * Copy is transcribed verbatim from the `chatFlyout.*` de bundle that the real
 * menu renders, so drift is visible in review. (The bundle's "Hilfe Anfragen"
 * capitalisation is a product-copy question, not a Storybook one.)
 */
export const ShippedSessionListMenu: Story = {
	render: () => (
		<ChatMenuDropdown ariaLabel="Chatraum Einstellungen">
			<ChatMenuDropdownHeader
				subtitle="Jeder Raum individuell anpassbar"
				title="Chatraum Einstellungen"
			/>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownSection>
				<ChatMenuDropdownItem
					icon={<ArchiveIcon />}
					title="Archivieren"
					description="Archivierte Benachrichtigungen sind inaktiv. Der Chat wird in 12 Monaten gelöscht."
				/>
				<ChatMenuDropdownItem
					icon={<TrashIcon />}
					title="Löschen"
					description="Chat dauerhaft löschen."
				/>
				<ChatMenuDropdownItem
					icon={<HelpIcon />}
					title="Hilfe Anfragen"
					description="Eskaliere den Fall intern oder extern ohne den Datenschutz zu vernachlässigen."
				/>
			</ChatMenuDropdownSection>
		</ChatMenuDropdown>
	)
};

export const LegalLinksMenu: Story = {
	render: () => (
		<ChatMenuDropdown ariaLabel="Chat legal menu">
			<ChatMenuDropdownHeader
				subtitle="Rechtliche Informationen"
				title="Chat Informationen"
			/>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownSection>
				<ChatMenuDropdownItem
					icon={<HelpIcon />}
					title="Datenschutzerklärung"
					description="Lese wie diese Beratungsstelle deine Daten verarbeitet."
				/>
				<ChatMenuDropdownItem
					icon={<ArchiveIcon />}
					title="Impressum"
					description="Kontakt- und Anbieterinformationen öffnen."
				/>
			</ChatMenuDropdownSection>
		</ChatMenuDropdown>
	)
};
