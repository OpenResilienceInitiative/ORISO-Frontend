import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { apiSetDoNotDisturb } from '../../../api/apiDoNotDisturb';
import { computeDndUntil, DND_OPTIONS, DndOption } from './dndHelpers';

/* ------------------------------------------------------------------ *
 * Presentational
 * ------------------------------------------------------------------ */

export interface DoNotDisturbControlViewProps {
	/** ISO timestamp DND lasts until, or null when off. */
	dndUntil: string | null;
	onSelect: (option: DndOption) => void;
}

export const DoNotDisturbControlView = ({
	dndUntil,
	onSelect
}: DoNotDisturbControlViewProps) => {
	const { t } = useTranslation();
	const active = !!dndUntil && new Date(dndUntil).getTime() > Date.now();

	return (
		<div className="notificationSettings__dnd" data-cy="dnd-control">
			<Headline
				text={t('profile.notifications.dnd.title')}
				semanticLevel="5"
			/>
			<Text
				text={
					active
						? t('profile.notifications.dnd.activeUntil', {
								time: new Date(
									dndUntil as string
								).toLocaleString()
							})
						: t('profile.notifications.dnd.description')
				}
				type="infoLargeAlternative"
			/>
			<div
				className="notificationSettings__dndOptions"
				role="group"
				aria-label={t('profile.notifications.dnd.title')}
			>
				{DND_OPTIONS.map((option) => (
					<button
						key={option}
						type="button"
						className="notificationSettings__dndOption"
						aria-pressed={
							option === 'off' ? !active : active && false
						}
						onClick={() => onSelect(option)}
						data-cy={`dnd-option-${option}`}
					>
						{t(`profile.notifications.dnd.option.${option}`)}
					</button>
				))}
			</div>
		</div>
	);
};

/* ------------------------------------------------------------------ *
 * Container
 * ------------------------------------------------------------------ */

interface DoNotDisturbControlProps {
	dndUntil: string | null;
	/** Persists into the cross-device notification settings (announcement gate). */
	onChange: (dndUntil: string | null) => void;
}

export const DoNotDisturbControl = ({
	dndUntil,
	onChange
}: DoNotDisturbControlProps) => {
	const handleSelect = useCallback(
		(option: DndOption) => {
			const until = computeDndUntil(option);
			// Cross-device announcement suppression (account data) …
			onChange(until);
			// … and the authoritative server store that also gates emails.
			apiSetDoNotDisturb(until).catch(() => undefined);
		},
		[onChange]
	);

	return (
		<DoNotDisturbControlView dndUntil={dndUntil} onSelect={handleSelect} />
	);
};
