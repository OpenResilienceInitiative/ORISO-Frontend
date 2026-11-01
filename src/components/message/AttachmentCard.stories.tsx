import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AttachmentCard, AttachmentCardProps } from './AttachmentCard';
import { LoadingSpinner } from '../loadingSpinner/LoadingSpinner';
import { getIconForAttachmentType } from './messageHelpers';

/**
 * #994 — every attachment state shares one card. Line them up here so a
 * reviewer can see at a glance that they do.
 */
const meta = {
	title: 'Components/Chat/AttachmentCard',
	component: AttachmentCard,
	parameters: {
		docs: {
			description: {
				component:
					'One card for every attachment state: downloadable, encrypted, awaiting the media check, and blocked. Colours come from the M3 tokens, so the card follows the light and dark scheme.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div style={{ padding: 20, maxWidth: 460 }}>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof AttachmentCard>;

export default meta;
type Story = StoryObj<typeof AttachmentCard>;

const PdfIcon = getIconForAttachmentType('application/pdf');
const pdfIcon = PdfIcon ? (
	<PdfIcon aria-hidden="true" focusable="false" />
) : null;

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAABICAYAAAA9HjF/AAAAwElEQVR4nO3RsQkAIBDAwK/dfwXn1DGEeMX1gcyedeia1wEYjMEY/CmD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjO4DiD4wyOMzjuAl4Hs8nHnWSXAAAAAElFTkSuQmCC';

export const Downloadable: Story = {
	args: {
		action: {
			kind: 'download',
			href: PNG_DATA_URL,
			fileName: 'ORISO (Repository Guide).pdf'
		},
		icon: pdfIcon,
		fileName: 'ORISO (Repository Guide).pdf',
		meta: 'PDF | 0.07 MB',
		actionLabel: 'ORISO (Repository Guide).pdf herunterladen'
	}
};

/** The name truncates on one line instead of breaking the bubble. */
export const LongFileName: Story = {
	args: {
		...Downloadable.args,
		fileName:
			'Protokoll-der-Fallbesprechung-vom-2026-08-08-mit-allen-Beteiligten-final-v3.pdf',
		actionLabel: 'Protokoll herunterladen'
	}
};

export const WithImagePreview: Story = {
	args: {
		action: {
			kind: 'download',
			href: PNG_DATA_URL,
			fileName: 'pattern.png'
		},
		fileName: 'pattern.png',
		meta: 'PNG | 0.01 MB',
		actionLabel: 'pattern.png herunterladen',
		preview: (
			<span className="attachmentCard__preview">
				<img src={PNG_DATA_URL} alt="" />
			</span>
		)
	}
};

export const EncryptedLocked: Story = {
	args: {
		action: { kind: 'unlock', onUnlock: () => undefined },
		icon: pdfIcon,
		fileName: 'befund.pdf',
		meta: 'Verschlüsselt — zum Entschlüsseln antippen',
		actionLabel: 'befund.pdf entschlüsseln'
	}
};

export const Decrypting: Story = {
	args: {
		action: { kind: 'unlock', onUnlock: () => undefined, busy: true },
		icon: <LoadingSpinner />,
		fileName: 'befund.pdf',
		meta: 'Wird entschlüsselt …',
		actionLabel: 'befund.pdf wird entschlüsselt'
	}
};

export const AwaitingMediaCheck: Story = {
	args: {
		action: { kind: 'none' },
		fileName: 'gast-bild.png',
		meta: 'Bild aus anonymem Chat – noch nicht geprüft',
		actionLabel: 'gast-bild.png – noch nicht geprüft',
		preview: (
			<span className="attachmentCard__preview attachmentCard__preview--blurred">
				<button type="button" className="attachmentCard__reveal">
					Bild anzeigen
				</button>
			</span>
		)
	}
};

export const Blocked: Story = {
	args: {
		action: { kind: 'none' },
		blocked: true,
		icon: pdfIcon,
		fileName: 'virus.pdf',
		meta: 'Von der Sicherheitsprüfung blockiert',
		actionLabel: 'virus.pdf – von der Sicherheitsprüfung blockiert'
	}
};

/** All states stacked — the point of the issue is that they match. */
export const AllStates: Story = {
	args: Downloadable.args,
	render: () => (
		<div style={{ display: 'grid', gap: 12 }}>
			{[
				Downloadable.args,
				LongFileName.args,
				EncryptedLocked.args,
				Decrypting.args,
				Blocked.args
			]
				.map((cardArgs) => cardArgs as AttachmentCardProps)
				.map((cardArgs) => (
					<AttachmentCard key={cardArgs.fileName} {...cardArgs} />
				))}
		</div>
	)
};
