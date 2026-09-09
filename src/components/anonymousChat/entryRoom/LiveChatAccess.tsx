import * as React from 'react';
import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import type { Pseudonym } from '../../../utils/anonName/engine';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';

export interface LiveChatAccessProps {
	/** The names on offer — four of them, already rolled by the room. */
	pseudonyms: Pseudonym[];
	/** Which one is taken; never -1, so „Zum Warteraum" always has a name. */
	selectedIndex: number;
	onSelect: (index: number) => void;
	onReroll: () => void;
	onContinue: () => void;
	busy?: boolean;
	/** The name could not be saved; the door stays open, with a reason. */
	failed?: boolean;
}

const LABEL_ID = 'live-chat-access-choice-label';

/**
 * A — the door. A name for today, no password: an access that deletes itself
 * needs none (Frank, 2026-09-05). The sentence under the names says so.
 *
 * Four names at once, not one die. One rolled name in a left-aligned card left
 * the screen nearly empty, on a phone above all (Frank, 2026-09-08: „statt nur
 * dem würfeln … mehrere angebote sieht … dann kann man zwischen drei vier
 * varianten wählen … zentriert also im weißen bereich … und ein sofort auch
 * ausgewählt haben"). So: a centred radio group, the first option already
 * taken, and whoever does not care simply presses on. Two across on a phone,
 * four across from `lg`; the cells are `minmax(0, 1fr)`, so a long name wraps
 * instead of pushing the column sideways.
 */
export const LiveChatAccess = ({
	pseudonyms,
	selectedIndex,
	onSelect,
	onReroll,
	onContinue,
	busy = false,
	failed = false
}: LiveChatAccessProps) => {
	const { t } = useTranslation();
	const tr = (key: string, fallback: string) =>
		translateWithFallback(t, `liveChat.entry.access.${key}`, fallback);
	const optionRefs = React.useRef<(HTMLElement | null)[]>([]);

	/* A radio group is one tab stop: the arrows walk it, and the walk moves
	   the selection with it — that is what a screen reader announces. */
	const step = (from: number, delta: number) => {
		if (pseudonyms.length === 0) return;
		const next = (from + delta + pseudonyms.length * 2) % pseudonyms.length;
		onSelect(next);
		optionRefs.current[next]?.focus();
	};
	const handleKeyDown = (
		event: React.KeyboardEvent<HTMLElement>,
		index: number
	) => {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			step(index, 1);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			step(index, -1);
		}
	};

	return (
		<>
			<Box
				sx={{
					width: '100%',
					maxWidth: 720,
					mx: 'auto',
					textAlign: 'center'
				}}
			>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 30, sm: 34 },
						lineHeight: { xs: '36px', sm: '41px' },
						fontWeight: 700,
						color: registrationMd3.onSurface
					}}
				>
					{tr('headline', 'Ihr Name für heute.')}
				</Typography>
				<Typography
					sx={{
						mt: 0.75,
						fontSize: 16,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{tr(
						'subline',
						'Anonym, ohne Konto. Wählen Sie einen Namen — oder würfeln Sie neue.'
					)}
				</Typography>
				<Typography
					id={LABEL_ID}
					sx={{
						mt: 3,
						fontSize: 11,
						fontWeight: 600,
						letterSpacing: '.12em',
						textTransform: 'uppercase',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{tr('label', 'Ihr Pseudonym')}
				</Typography>
				<Box
					role="radiogroup"
					aria-labelledby={LABEL_ID}
					data-cy="entry-room-pseudonym"
					sx={{
						display: 'grid',
						gridTemplateColumns: {
							xs: 'repeat(2, minmax(0, 1fr))',
							lg: 'repeat(4, minmax(0, 1fr))'
						},
						gap: { xs: 1.5, sm: 2 },
						mt: 1.5,
						mx: 'auto',
						width: '100%',
						maxWidth: { xs: 420, lg: 720 }
					}}
				>
					{pseudonyms.map((pseudonym, index) => {
						const selected = index === selectedIndex;
						return (
							<Box
								key={`${pseudonym.displayName}-${index}`}
								component="button"
								type="button"
								role="radio"
								aria-checked={selected}
								tabIndex={selected ? 0 : -1}
								disabled={busy}
								ref={(element: HTMLElement | null) => {
									optionRefs.current[index] = element;
								}}
								onClick={() => onSelect(index)}
								onKeyDown={(
									event: React.KeyboardEvent<HTMLElement>
								) => handleKeyDown(event, index)}
								data-cy={`entry-room-pseudonym-option-${index}`}
								sx={{
									'display': 'flex',
									'flexDirection': 'column',
									'alignItems': 'center',
									'gap': 1,
									'width': '100%',
									'minWidth': 0,
									'p': { xs: 1.75, sm: 2 },
									'borderRadius': '20px',
									'font': 'inherit',
									'textAlign': 'center',
									'cursor': busy ? 'default' : 'pointer',
									'bgcolor': selected
										? registrationMd3.selectedLayer
										: registrationMd3.surfaceContainer,
									'border': `2px solid ${
										selected
											? registrationMd3.primary
											: 'transparent'
									}`,
									'transition':
										'background-color 160ms ease, border-color 160ms ease',
									'&:hover': {
										bgcolor: selected
											? registrationMd3.selectedLayer
											: registrationMd3.surfaceContainerHigh
									},
									'&:focus-visible': {
										outline: `3px solid ${registrationMd3.focus}`,
										outlineOffset: '2px'
									}
								}}
							>
								<AnimalAvatar
									avatar={pseudonym.avatar}
									size={64}
								/>
								<Typography
									component="span"
									sx={{
										fontSize: 15,
										lineHeight: '20px',
										fontWeight: selected ? 700 : 500,
										color: registrationMd3.onSurface,
										overflowWrap: 'anywhere'
									}}
								>
									{pseudonym.displayName}
								</Typography>
							</Box>
						);
					})}
				</Box>
				<Box
					sx={{
						display: 'flex',
						gap: 1.25,
						alignItems: 'flex-start',
						textAlign: 'left',
						mt: 3,
						mx: 'auto',
						maxWidth: 560,
						fontSize: 13,
						lineHeight: '18px',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					<LockOutlinedIcon
						aria-hidden
						sx={{ fontSize: 18, flexShrink: 0, mt: '1px' }}
					/>
					<Typography
						sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}
					>
						{tr(
							'temporary',
							'Dieser Zugang gilt nur für dieses Gespräch. Danach löschen wir ihn — samt aller Nachrichten, spätestens nach 48 Stunden. Bleiben Sie in diesem Fenster, bis Sie dran sind.'
						)}
					</Typography>
				</Box>
				{failed && (
					<Typography
						role="alert"
						sx={{
							mt: 2,
							fontSize: 14,
							color: registrationMd3.error
						}}
					>
						{tr(
							'continueFailed',
							'Der Name konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.'
						)}
					</Typography>
				)}
			</Box>
			<RegistrationFooter
				secondary={{
					label: tr('reroll', 'Neu würfeln'),
					onClick: onReroll,
					disabled: busy
				}}
				primary={{
					label: tr('continue', 'Zum Warteraum'),
					onClick: onContinue,
					disabled: busy
				}}
			/>
		</>
	);
};
