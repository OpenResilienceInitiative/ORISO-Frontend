import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { GroupChatAuthorContentFields } from './GroupChatAuthorContentFields';
import type { GroupChatAuthorContentDraft } from './groupChatAuthorContent';
import './createChat.styles';
import '../conversationCreate/conversationCreate.styles';

/* ------------------------------------------------------------------ *
 * The welcome-and-rules card of the Gesprächskreis settings screen
 * (Figma 8467-27977, the second stacked card).
 *
 * The card is the reusable piece: a language chip row with the translate
 * action pinned right, a welcome box, a rule box, the rule chips and the
 * primary action. Every colour binds to an M3 role token, so a Träger's own
 * brand palette flows through it untouched.
 * ------------------------------------------------------------------ */

const emptyDraft = (
	languages: string[],
	withRules = true
): GroupChatAuthorContentDraft => ({
	sourceLanguage: languages[0],
	hintMessageTranslations: Object.fromEntries(
		languages.map((language) => [language, ''])
	),
	groupChatRulesTranslations: Object.fromEntries(
		languages.map((language) => [
			language,
			withRules
				? [
						'Sprich von dir selbst, nicht über andere.',
						'Was hier geteilt wird, bleibt hier.'
					]
				: []
		])
	)
});

/**
 * The card keeps its draft in the parent, exactly as CircleSettingsView does,
 * so the stories exercise the real round-trip rather than a frozen snapshot.
 */
const Card = ({
	languages,
	translationAvailable = true,
	withAction = true,
	withRules = true
}: {
	languages: string[];
	translationAvailable?: boolean;
	withAction?: boolean;
	withRules?: boolean;
}) => {
	const [draft, setDraft] = useState(() => emptyDraft(languages, withRules));
	return (
		<div style={{ background: '#e9e6e6', maxWidth: 420, padding: 24 }}>
			<div className="circleSettings__authorColumn">
				<GroupChatAuthorContentFields
					activeLanguages={languages}
					value={draft}
					onChange={setDraft}
					translationAvailable={translationAvailable}
				/>
				{withAction && (
					<button
						type="button"
						className="circleSettings__createButton"
						disabled
					>
						Erstellen
					</button>
				)}
			</div>
		</div>
	);
};

const meta = {
	title: 'GroupChat/AuthorContentCard',
	component: Card,
	parameters: { layout: 'centered' },
	tags: ['autodocs']
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two languages — the state a single-language agency starts from. */
export const TwoLanguages: Story = {
	args: { languages: ['de', 'en'] }
};

/**
 * Five languages, as the design shows them: the chip row scrolls rather than
 * wrapping, so the translate action keeps its place at the right edge.
 */
export const ManyLanguages: Story = {
	args: { languages: ['de', 'en', 'fr', 'tr', 'ru'] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('DE')).toBeInTheDocument();
		await expect(canvas.getByText('RU')).toBeInTheDocument();
	}
};

/** No translation key configured in the background — the action stays away. */
export const WithoutTranslationAction: Story = {
	args: { languages: ['de', 'en'], translationAvailable: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole('button', {
				name: /In aktive Sprachen übersetzen/i
			})
		).toBeNull();
	}
};

/**
 * Dropping a language takes its drafted welcome text and rules with it. The
 * tenant's own language configuration is untouched.
 */
export const RemovingALanguage: Story = {
	args: { languages: ['de', 'en', 'fr'] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('FR')).toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole('button', { name: /Sprache FR entfernen/i })
		);
		await expect(canvas.queryByText('FR')).toBeNull();
		await expect(canvas.getByText('DE')).toBeInTheDocument();
	}
};

/**
 * The add glyph is an *add* action: with an empty draft it appends a rule and
 * moves the caret into it, instead of sitting disabled until something is
 * typed.
 */
export const AddingARule: Story = {
	args: { languages: ['de'] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const before = canvas.getAllByRole('listitem').length;
		await userEvent.click(
			canvas.getByRole('button', { name: /Regel hinzufügen/i })
		);
		await expect(canvas.getAllByRole('listitem').length).toBe(before + 1);
	}
};

/**
 * A circle whose language carries no rules yet. The editor is handed the empty
 * list unfiltered, so a placeholder entry would surface here as a real,
 * deletable chip before the author has added anything.
 */
export const WithoutAnyRules: Story = {
	args: { languages: ['de'], withRules: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
		await userEvent.click(
			canvas.getByRole('button', { name: /Regel hinzufügen/i })
		);
		await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
	}
};
