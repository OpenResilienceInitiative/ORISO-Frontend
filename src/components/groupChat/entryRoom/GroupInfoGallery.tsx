import * as React from 'react';
import { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	HandoverCarousel,
	HandoverStep
} from '../../app/registrationLoader/HandoverCarousel';
import { selfHelpArtwork } from '../../../resources/img/registration-md3/registrationArtwork';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';
import { EntryRoomPanel } from './EntryRoomPanel';

/**
 * The three cards.
 *
 * PROVISIONAL COPY — Frank writes the final wording. What each card has to
 * say is settled (Frank, 2026-09-06), the sentences are not:
 *   1. how the group meets — chat, voice, video, or all of them
 *   2. only an alias, never a real name
 *   3. new dates and new links keep appearing
 *
 * Words and motifs are Frank's, delivered 2026-09-07; the pictures carry
 * meaning of their own, so each card hands the carousel a description for
 * anyone who cannot see them.
 */
export const SELF_HELP_INFO_STEPS: HandoverStep[] = [
	{
		key: 'formats',
		artwork: selfHelpArtwork.format,
		titleKey: 'groupChat.info.gallery.steps.formats.title',
		textKey: 'groupChat.info.gallery.steps.formats.text',
		altKey: 'groupChat.info.gallery.steps.formats.alt',
		titleFallback: 'So findet die Gruppe statt',
		textFallback:
			'Am Namen erkennen Sie, ob Sie schreiben, sprechen, sich sehen oder alles kombinieren. Ton und Kamera schalten Sie bei Bedarf dazu.',
		altFallback:
			'Neugierige Person im Gruppenraum; zentral angeordnete Symbole für Chat, Mikrofon und Kamera, verbunden durch einen dezenten Schutzschild.'
	},
	{
		key: 'alias',
		artwork: selfHelpArtwork.alias,
		titleKey: 'groupChat.info.gallery.steps.alias.title',
		textKey: 'groupChat.info.gallery.steps.alias.text',
		altKey: 'groupChat.info.gallery.steps.alias.alt',
		titleFallback: 'Bitte nur mit Alias',
		textFallback:
			'Alles ist Ende-zu-Ende verschlüsselt. Nennen Sie trotzdem keine echten Namen – das schützt alle.',
		altFallback:
			'Geschützte Gruppe mit abstrakten Alias-Symbolen statt Namen und Profilbildern; persönliche Namenskarte bleibt sichtbar außerhalb des geschützten Raums.'
	},
	{
		key: 'dates',
		artwork: selfHelpArtwork.dates,
		titleKey: 'groupChat.info.gallery.steps.dates.title',
		textKey: 'groupChat.info.gallery.steps.dates.text',
		altKey: 'groupChat.info.gallery.steps.dates.alt',
		titleFallback: 'Neue Termine, neue Links',
		textFallback:
			'Im Link-Bereich finden Sie regelmäßig frische Treffen und gelangen direkt zum nächsten Termin.',
		altFallback:
			'Neue Terminkarten erscheinen nacheinander; ein klares Linksymbol führt die neugierige Person zum nächsten Gruppentreffen.'
	}
];

export interface GroupInfoGalleryProps {
	/** Back to the waiting room. Called once the slide-back has played. */
	onBack: () => void;
	/** Override the three cards (stories, later wording). */
	steps?: HandoverStep[];
}

/**
 * "So funktioniert die Selbsthilfegruppe" — the explainer behind the waiting
 * room's "Mehr erfahren" (Frank, 2026-09-06: "zu einem dieser drei Fenster,
 * Infoboxen, wo man so eine Galerie hat zum Scrollen").
 *
 * The same carousel module as the registration handover and the live chat's
 * waiting room, with this screen's cards — one carousel in the product, not a
 * second one that drifts: it already knows the desktop card height and crop,
 * the mobile switch, the dots and the lazy images.
 *
 * Only the cards: the dates have their own view behind the bar's "Weitere
 * Termine" (Frank, 2026-10-19 — under the cards they ran into them).
 */
export const GroupInfoGallery = ({
	onBack,
	steps = SELF_HELP_INFO_STEPS
}: GroupInfoGalleryProps) => {
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.info.gallery.${key}`, fallback),
		[t]
	);

	return (
		<EntryRoomPanel
			onBack={onBack}
			backLabel={tr('back', 'Zurück zum Countdown')}
			backTestId="group-info-back"
			dataCy="group-info-gallery"
		>
			<Box sx={{ mb: { xs: 2, sm: 3 } }}>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 26, sm: 32 },
						lineHeight: { xs: '32px', sm: '38px' },
						fontWeight: 700,
						color: registrationMd3.onSurface
					}}
				>
					{tr('headline', 'So funktioniert die Gruppe')}
				</Typography>
				<Typography
					sx={{
						mt: 1,
						fontSize: 16,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{tr(
						'subline',
						'Drei Dinge, die vor dem ersten Mal helfen.'
					)}
				</Typography>
			</Box>

			<Box
				sx={{
					/* From `sm` the cards have their own height; the panel
					   scrolls on a short laptop instead of squeezing them. */
					flex: { xs: 1, sm: 'none' },
					minHeight: { xs: 0, sm: 'auto' },
					display: 'flex',
					flexDirection: 'column'
					/* No negative margin for a full-bleed row: the panel
					   clips its own box so the slide-in never adds a
					   horizontal scrollbar, and a bleed would be cut off
					   there instead of running to the screen edge — at
					   375 px it took 19 px off the first card and with it
					   the first letter of every line (measured
					   2026-09-07). The carousel keeps its own gap. */
				}}
			>
				<HandoverCarousel steps={steps} />
			</Box>
		</EntryRoomPanel>
	);
};
