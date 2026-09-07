import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useTranslation } from 'react-i18next';
import {
	HandoverCarousel,
	HandoverStep
} from '../../app/registrationLoader/HandoverCarousel';
import {
	liveChatArtwork,
	processArtwork
} from '../../../resources/img/registration-md3/registrationArtwork';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';

/** How long the panel takes to slide in or out. Mirrored in the keyframes. */
const SLIDE_MS = 320;

const reducedMotion = () =>
	typeof window.matchMedia !== 'function' ||
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The three cards.
 *
 * PROVISIONAL COPY — Frank writes the final wording. What each card has to
 * say is settled (Frank, 2026-09-06), the sentences are not:
 *   1. the group runs as chat, audio or video and always has counsellors in it
 *   2. the dates can go into the calendar beforehand
 *   3. everyone stays anonymous — no real names, no addresses
 *
 * The motifs are stand-ins from the registration set, picked for what they
 * show, not for this screen: `processArtwork.counsellor` (a counsellor with
 * the person), `liveChatArtwork.wait` (a clock) and `liveChatArtwork.anonymous`
 * (anonymity). Swap them the moment the group's own motifs exist.
 */
const infoSteps: HandoverStep[] = [
	{
		key: 'formats',
		artwork: processArtwork.counsellor,
		titleKey: 'groupChat.info.gallery.steps.formats.title',
		textKey: 'groupChat.info.gallery.steps.formats.text',
		titleFallback: 'Als Chat, Audio oder Video',
		textFallback:
			'Die Gruppe trifft sich schriftlich, mit Ton oder mit Bild. Begleitet wird sie immer von Beraterinnen und Beratern.'
	},
	{
		key: 'appointments',
		artwork: liveChatArtwork.wait,
		titleKey: 'groupChat.info.gallery.steps.appointments.title',
		textKey: 'groupChat.info.gallery.steps.appointments.text',
		titleFallback: 'Termine vorher eintragen',
		textFallback:
			'Sie können sich die Termine der Gruppe schon jetzt in Ihren Kalender eintragen und werden rechtzeitig erinnert.'
	},
	{
		key: 'anonymous',
		artwork: liveChatArtwork.anonymous,
		titleKey: 'groupChat.info.gallery.steps.anonymous.title',
		textKey: 'groupChat.info.gallery.steps.anonymous.text',
		titleFallback: 'Sie bleiben anonym',
		textFallback:
			'Bitte nennen Sie keine echten Namen und keine Adressen — weder Ihre eigenen noch die anderer.'
	}
];

export interface GroupInfoGalleryProps {
	/** Back to the waiting room. Called once the slide-back has played. */
	onBack: () => void;
	/**
	 * The calendar action of card 2. Optional on purpose: no URL is invented
	 * here — whoever mounts the gallery knows where the dates live, and while
	 * nobody does the button simply is not there.
	 */
	onOpenAppointments?: () => void;
	/**
	 * The next dates of this group, soonest first. Read only: nobody books
	 * anything here — a self-help group has its dates, and this is where a
	 * person looks them up (Frank, 2026-09-07: "Hier sind es nicht Termine
	 * buchen, sondern Termine ansehen … die nächsten Daten, das reicht").
	 */
	upcomingDates?: Date[];
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
 * A pure view: no routing, no API. It comes in from the right edge and moves
 * left into place, and it leaves the same way it came — Frank asked for the
 * "back and forth" explicitly. `prefers-reduced-motion` gets neither, the
 * panel is simply there and simply gone.
 */
export const GroupInfoGallery = ({
	onBack,
	onOpenAppointments,
	upcomingDates,
	steps = infoSteps
}: GroupInfoGalleryProps) => {
	const { t, i18n } = useTranslation();
	/* The dates follow the language the person reads, not the browser's —
	   `undefined` gave "Thu, 09/10, 06:00 PM" in a German interface. */
	const dateFormat = React.useMemo(
		() =>
			new Intl.DateTimeFormat(i18n?.resolvedLanguage || i18n?.language, {
				weekday: 'short',
				day: '2-digit',
				month: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}),
		[i18n?.language, i18n?.resolvedLanguage]
	);
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.info.gallery.${key}`, fallback),
		[t]
	);
	const [leaving, setLeaving] = useState(false);
	/* The slide-out may end twice (animationend and the timer); the waiting
	   room must come back once. */
	const done = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const finish = useCallback(() => {
		if (done.current) {
			return;
		}
		done.current = true;
		onBack();
	}, [onBack]);

	const requestBack = useCallback(() => {
		if (done.current || leaving) {
			return;
		}
		if (reducedMotion()) {
			finish();
			return;
		}
		setLeaving(true);
		/* jsdom and any browser that drops the animation never fire
		   `animationend`; the timer is what guarantees the way back. */
		timer.current = setTimeout(finish, SLIDE_MS);
	}, [finish, leaving]);

	useEffect(() => () => clearTimeout(timer.current), []);

	/* Escape closes the panel like any other overlay. */
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				requestBack();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [requestBack]);

	/* The gallery is a step, not a page: a marker entry makes the browser's
	   back button (and the phone's back gesture) mean "back to the waiting
	   room" instead of "leave the group". Popped again on the way out so the
	   history does not grow with every look at the explainer. */
	const finishRef = useRef(finish);
	finishRef.current = finish;
	useEffect(() => {
		window.history.pushState({ groupInfoGallery: true }, '');
		const onPopState = () => finishRef.current();
		window.addEventListener('popstate', onPopState);
		return () => {
			window.removeEventListener('popstate', onPopState);
			if (window.history.state?.groupInfoGallery) {
				window.history.back();
			}
		};
	}, []);

	return (
		<Box
			data-cy="group-info-gallery"
			sx={{
				// Clips its own child while that child sits off to the right,
				// so the slide never adds a horizontal scrollbar to the page.
				overflow: 'hidden',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				minHeight: 0
			}}
		>
			<Box
				onAnimationEnd={leaving ? finish : undefined}
				sx={{
					'display': 'flex',
					'flexDirection': 'column',
					'flex': 1,
					'minHeight': 0,
					/* The dates under the cards can be more than the column
					   has left; the panel scrolls inside itself rather than
					   pushing the page, which would move the bar. */
					'overflowY': 'auto',
					'animation': `${
						leaving ? 'groupInfoGalleryOut' : 'groupInfoGalleryIn'
					} ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) both`,
					// In from the right edge, moving left into place; out the
					// same way (Frank: "nach links sliden … und auch ein
					// Backbutton, um zum Warteraum zurückzukehren").
					'@keyframes groupInfoGalleryIn': {
						from: { transform: 'translateX(100%)', opacity: 0 },
						to: { transform: 'translateX(0)', opacity: 1 }
					},
					'@keyframes groupInfoGalleryOut': {
						from: { transform: 'translateX(0)', opacity: 1 },
						to: { transform: 'translateX(100%)', opacity: 0 }
					},
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					}
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						mb: { xs: 1.5, sm: 2 }
					}}
				>
					<IconButton
						onClick={requestBack}
						data-testid="group-info-back"
						aria-label={tr('back', 'Zurück zum Countdown')}
						size="small"
						sx={{ color: registrationMd3.onSurfaceVariant }}
					>
						<ArrowBackRoundedIcon />
					</IconButton>
					<Typography
						sx={{
							fontSize: 14,
							fontWeight: 600,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{tr('back', 'Zurück zum Countdown')}
					</Typography>
				</Box>

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
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column'
						/* No negative margin for a full-bleed row: the panel
						   above clips its own box so the slide-in never adds a
						   horizontal scrollbar, and a bleed would be cut off
						   there instead of running to the screen edge — at
						   375 px it took 19 px off the first card and with it
						   the first letter of every line (measured
						   2026-09-07). The carousel keeps its own gap. */
					}}
				>
					<HandoverCarousel
						steps={steps}
						cardWidth={{ xs: 300, sm: 372 }}
					/>
				</Box>

				{!!upcomingDates?.length && (
					<Box sx={{ mt: { xs: 1.5, sm: 2 } }}>
						<Typography
							component="h2"
							sx={{
								fontSize: 14,
								fontWeight: 600,
								color: registrationMd3.onSurface,
								mb: 0.75
							}}
						>
							{tr('upcoming', 'Nächste Termine')}
						</Typography>
						<Box
							component="ul"
							sx={{
								display: 'flex',
								flexWrap: 'wrap',
								gap: 1,
								listStyle: 'none',
								m: 0,
								p: 0
							}}
						>
							{upcomingDates.map((date) => (
								<Typography
									component="li"
									key={date.toISOString()}
									sx={{
										fontSize: 13,
										color: registrationMd3.onSurfaceVariant,
										border: `1px solid ${registrationMd3.outlineVariant}`,
										borderRadius: '999px',
										px: 1.5,
										py: 0.5
									}}
								>
									{dateFormat.format(date)}
								</Typography>
							))}
						</Box>
					</Box>
				)}

				{onOpenAppointments && (
					<Box sx={{ mt: { xs: 2, sm: 2.5 } }}>
						<Button
							variant="outlined"
							size="small"
							startIcon={<CalendarMonthRoundedIcon />}
							onClick={onOpenAppointments}
							data-testid="group-info-appointments"
						>
							{tr('appointments', 'Termine in den Kalender')}
						</Button>
					</Box>
				)}
			</Box>
		</Box>
	);
};
