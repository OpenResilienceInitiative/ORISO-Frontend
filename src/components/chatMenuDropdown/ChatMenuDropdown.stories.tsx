import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as BellOffIcon } from '../../resources/img/icons/bell-off.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as PackageIcon } from '../../resources/img/icons/documents.svg';
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
					'Reusable ORISO chat menu matching the App.Oriso Figma menu surface. Used for chat/session action dropdowns.'
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

export const FigmaReference: Story = {
	render: () => <FigmaMenuItems />
};

export const ActiveState: Story = {
	render: () => <FigmaMenuItems activeFirst />
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
