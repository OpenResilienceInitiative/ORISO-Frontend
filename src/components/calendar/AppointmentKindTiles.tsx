/**
 * "Art" of an appointment as four tiles in a grid that wraps, never a row
 * that runs out of the dialog (Frank *1; test C7). One part for every door
 * that creates an appointment: the calendar's "Neuer Eintrag" and "Termin
 * anlegen" in a 1:1 conversation use the same tiles (one invitation flow).
 */
import * as React from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FacetIcon } from './CalendarEntryGlyph';
import { APPOINTMENT_KINDS, type AppointmentKind } from './calendarModel';
import './appointmentKindTiles.styles.scss';

export interface AppointmentKindTilesProps {
	value: AppointmentKind;
	onChange: (kind: AppointmentKind) => void;
	/** The kinds offered; all four unless narrowed (FE#2305: on site only). */
	kinds?: readonly AppointmentKind[];
}

export const AppointmentKindTiles = ({
	value,
	onChange,
	kinds = APPOINTMENT_KINDS
}: AppointmentKindTilesProps) => {
	const { t } = useTranslation();
	const id = useId();
	return (
		<div
			className="appointmentKindTiles"
			role="group"
			aria-labelledby={`${id}-kind`}
			data-section="kind"
		>
			<span id={`${id}-kind`} className="appointmentKindTiles__label">
				{t('calendar.dialog.kind')}
			</span>
			<div className="calendarDialog__kinds">
				{kinds.map((kind) => (
					<button
						key={kind}
						type="button"
						className="calendarDialog__kindTile"
						aria-pressed={kind === value}
						onClick={() => onChange(kind)}
						data-cy={`calendar-dialog-kind-${kind}`}
					>
						<FacetIcon facet={kind} />
						<span>{t(`calendar.kinds.${kind}`)}</span>
					</button>
				))}
			</div>
		</div>
	);
};
