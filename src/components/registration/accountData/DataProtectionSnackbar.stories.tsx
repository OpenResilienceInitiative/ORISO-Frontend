import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { DataProtectionSnackbar } from './DataProtectionSnackbar';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import { phone375Globals } from '../../message/messageStoryShell';

/* What `config.ts` ships by default: the privacy document first, the imprint
   second, both identified by their untranslated key. */
const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => '/datenschutz'
	},
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => '/impressum'
	}
] as never;

const meta = {
	title: 'REGISTRATION/DataProtectionSnackbar',
	component: DataProtectionSnackbar,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Der Datenschutz-Hinweis am Konto-Schritt des Live-Chats (ORISO-Frontend#1341, Punkt 5). An der Stelle, an der sonst die Zustimmungs-Box steht — aber ohne Häkchen: die eigentliche Zustimmung wird später im Warteraum eingeholt, wenn eine Beratungsstelle überhaupt bekannt ist. Der Satz ist die Vorgabe und steht in allen sieben Katalogen; ein frisch aufgesetzter Mandant sieht ihn, ohne dass jemand etwas eingetragen hat. „Datenschutzbestimmung" öffnet dasselbe Popup wie „Datenschutzerklärung" im Fuß der Bühne — dieselbe Komponente, nicht ein zweites Modal.'
			}
		}
	},
	decorators: [
		(Story) => (
			<LegalLinksContext.Provider value={legalLinks}>
				<Box
					sx={{
						bgcolor: registrationMd3.surface,
						p: 3,
						maxWidth: 540
					}}
				>
					<Story />
				</Box>
			</LegalLinksContext.Provider>
		)
	]
} satisfies Meta<typeof DataProtectionSnackbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ImLiveChat: Story = {
	name: 'Im Live-Chat',
	args: {}
};

export const Mobil: Story = {
	name: 'Mobil (375 pt)',
	globals: phone375Globals,
	args: {},
	parameters: {
		docs: {
			description: {
				story: 'Auf dem Telefon nimmt der Hinweis fast die ganze Spalte. Drei Zeilen Text und das Kreuz — genau die Form aus dem Figma-Entwurf (CAR02 live chat, 2183-15069).'
			}
		}
	}
};
