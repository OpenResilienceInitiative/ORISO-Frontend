import * as React from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HistoryToggleOffOutlinedIcon from '@mui/icons-material/HistoryToggleOffOutlined';
import AltRouteOutlinedIcon from '@mui/icons-material/AltRouteOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { SplitButton } from '../splitButton/SplitButton';
import { RowMenu } from '../conversationCreate/RowMenu';
import {
	GuestAccountMode,
	guestAccountModeHintKey,
	guestAccountModeLabelKey,
	offeredGuestAccountModes
} from './guestAccountMode';
import '../conversationCreate/conversationCreate.styles.scss';
import './guestAccountModeSelect.styles.scss';

/*
 * In a dialog, popover or bottom sheet the menu goes into the modal's own
 * root: a menu in the body would sit under the modal's backdrop and outside
 * its focus trap.
 */
const modalRootOf = (element: Element | null) =>
	element?.closest('.MuiModal-root, .MuiDialog-root') ?? null;

const ICONS: Record<GuestAccountMode, React.ReactNode> = {
	TEMPORARY: <HistoryToggleOffOutlinedIcon />,
	GUEST_CHOOSES: <AltRouteOutlinedIcon />,
	PERMANENT: <PersonOutlineOutlinedIcon />
};

export interface GuestAccountModeSelectProps {
	value: GuestAccountMode;
	onChange: (mode: GuestAccountMode) => void;
	/**
	 * The modes the platform and the Träger allow (call share links send
	 * them). Absent: all three; the server refuses a forbidden one.
	 */
	allowed?: readonly GuestAccountMode[] | null;
	/** Under the hint, e.g. "Gilt nur für Personen, die den Link neu öffnen." */
	note?: string;
	size?: 'medium' | 'compact';
	/**
	 * `false` leaves the sentence under the select out, where height is
	 * short (the call share popover must stay above the call toolbar).
	 */
	showHint?: boolean;
	className?: string;
	/** Stories open the menu directly. */
	defaultOpen?: boolean;
}

/**
 * UserService#1662: "Gastkonto" as a split-button select, the same pattern
 * as the topic row of the direct-link card (`SplitButton` + `RowMenu`):
 * the label is the chosen mode, tonal while closed, elevated while open.
 * Replaces the "Temporäres Konto" switches.
 */
export const GuestAccountModeSelect = ({
	value,
	onChange,
	allowed,
	note,
	size = 'medium',
	showHint = true,
	className,
	defaultOpen = false
}: GuestAccountModeSelectProps) => {
	const { t } = useTranslation();
	const id = useId();
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(defaultOpen);
	const modes = offeredGuestAccountModes(allowed);
	if (modes.length === 0) return null;

	return (
		<div
			className={`guestAccountModeSelect${className ? ` ${className}` : ''}`}
			data-testid="guest-account-mode-select"
		>
			<span id={`${id}-label`} className="guestAccountModeSelect__label">
				{t('guestAccountMode.label')}
			</span>
			<SplitButton
				ref={anchorRef}
				id={`${id}-button`}
				fullWidth
				size={size}
				icon={ICONS[value]}
				label={t(guestAccountModeLabelKey(value))}
				variant={open ? 'elevated' : 'tonal'}
				open={open}
				mainOpensMenu
				onClick={() => setOpen((current) => !current)}
				onToggleMenu={() => setOpen((current) => !current)}
				menuLabel={t('guestAccountMode.menuLabel')}
				describedBy={showHint ? `${id}-hint` : undefined}
			/>
			{open && (
				<RowMenu
					options={modes.map((mode) => ({
						value: mode,
						label: t(guestAccountModeLabelKey(mode))
					}))}
					value={value}
					onSelect={(next) => {
						setOpen(false);
						if (next !== value) onChange(next as GuestAccountMode);
					}}
					anchorRef={anchorRef}
					onClose={() => setOpen(false)}
					labelledBy={`${id}-label`}
					container={modalRootOf(anchorRef.current)}
				/>
			)}
			{showHint && (
				<span
					id={`${id}-hint`}
					className="guestAccountModeSelect__hint"
				>
					{t(guestAccountModeHintKey(value))}
					{note ? ` ${note}` : ''}
				</span>
			)}
		</div>
	);
};
