/**
 * Clicking or dragging over free time opens this menu right there: the time
 * is already chosen, so one tap says what it becomes — one of the four
 * appointment kinds or a blocked time (Frank, 2026-11-14).
 */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Popover } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem
} from '../chatMenuDropdown/ChatMenuDropdown';
import { APPOINTMENT_KINDS, type AppointmentKind } from './calendarModel';
import { FacetIcon } from './CalendarEntryGlyph';
import { useRangeFormat } from './useEntryLabel';
import '../chatMenuDropdown/chatMenuDropdown.styles.scss';

export type SlotChoice = AppointmentKind | 'blocker';

export interface SlotActionMenuProps {
	range: { start: Date; end: Date } | null;
	anchor: { x: number; y: number };
	onChoose: (choice: SlotChoice) => void;
	onClose: () => void;
}

export const SlotActionMenu = ({
	range,
	anchor,
	onChoose,
	onClose
}: SlotActionMenuProps) => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const menuRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (range)
			requestAnimationFrame(() =>
				menuRef.current?.querySelector<HTMLElement>('button')?.focus()
			);
	}, [range]);
	return (
		<Popover
			open={!!range}
			onClose={onClose}
			anchorReference="anchorPosition"
			anchorPosition={{ top: anchor.y, left: anchor.x }}
			transformOrigin={{ vertical: 'top', horizontal: 'left' }}
			PaperProps={{
				sx: { background: 'transparent', boxShadow: 'none' }
			}}
		>
			{range && (
				<ChatMenuDropdown
					ref={menuRef}
					density="compact"
					ariaLabel={t('calendar.slotMenu.label')}
					style={{ width: 248 }}
					data-cy="calendar-slot-menu"
				>
					<ChatMenuDropdownHeader
						subtitle={t('calendar.slotMenu.label')}
						title={format(range.start, range.end)}
					/>
					{APPOINTMENT_KINDS.map((kind) => (
						<ChatMenuDropdownItem
							key={kind}
							icon={<FacetIcon facet={kind} />}
							title={t(`calendar.kinds.${kind}`)}
							onClick={() => onChoose(kind)}
						/>
					))}
					<ChatMenuDropdownDivider />
					<ChatMenuDropdownItem
						icon={<FacetIcon facet="blocker" />}
						title={t('calendar.blocker.menuItem')}
						onClick={() => onChoose('blocker')}
					/>
				</ChatMenuDropdown>
			)}
		</Popover>
	);
};
