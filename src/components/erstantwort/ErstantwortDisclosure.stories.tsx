import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ErstantwortDisclosure } from './ErstantwortDisclosure';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Erstantwort-Disclosure** — one collapsible question row, the atom the FAQ
 * layout proposal is built from
 * (`0 - Docs/VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`).
 *
 * Built rather than reused, and the reason is worth checking before anybody
 * "simplifies" it away: the two disclosures this repository already has
 * (`WhyLocalDisclosure`, `DepartmentLegalSection`) are MUI components drawing
 * their colours from the registration theme, and the chat surface imports no
 * MUI at all. Four rows in a chat bubble are not worth that dependency.
 *
 * What to check here:
 *
 * - The closed panel is **unmounted**, not hidden — nothing collapsed is read
 *   out by a screen reader or reachable with Tab.
 * - `aria-expanded` and `aria-controls` sit on a native `<button>`, so Enter
 *   and Space work without a key handler.
 * - The focus ring is the platform's own (ORISO-Frontend#113), not the browser
 *   default, which is nearly invisible on the bubble's grey.
 */
const meta = {
	title: 'Components/Chat/Erstantwort-Disclosure',
	component: ErstantwortDisclosure,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<div
				className="pseudonymCard__bubble erstantwort__bubble"
				style={{ width: '100%', maxWidth: 520 }}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof ErstantwortDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

const ANSWER =
	'Ihre Nachricht lesen ausschließlich die Fachkräfte der zuständigen Beratungsstelle. Alle sind zur Verschwiegenheit verpflichtet.';

/** The resting state: a question, a chevron, nothing else. */
export const Closed: Story = {
	args: {
		question: 'Wer liest meine Nachricht?',
		children: <p>{ANSWER}</p>
	}
};

/** Opened. The body is the frozen Baustein wording, unchanged (ADR-018 §4). */
export const Open: Story = {
	args: { ...Closed.args, defaultOpen: true }
};

/**
 * A row whose question wraps. German questions are long and the phone column
 * is narrow, so the chevron has to stay put while the label takes two lines.
 */
export const LongQuestionOnPhone: Story = {
	args: {
		question:
			'Was passiert mit meinen Daten, wenn ich die Beratung abbreche?',
		children: <p>{ANSWER}</p>
	},
	globals: phone390Globals
};
