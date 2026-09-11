import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { Switch } from '../../Switch';
import { EmailToggle } from './EmailToggle';
import { NotificationSwitch } from './notificationMatrix';

/**
 * One row of the notification matrix.
 *
 * Dispatches on where the value lives, because the platform stores the same
 * concept two ways: four occasions in the `notificationsSettings` JSON blob,
 * and the counsellor's two most-used ones as columns reached through
 * `emailToggles`. The screen presents one list; the storage split stays behind
 * this component.
 */
export const NotificationSwitchRow = ({
	entry,
	highlighted
}: {
	entry: NotificationSwitch;
	highlighted?: boolean;
}) => {
	const ref = React.useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (highlighted && ref.current) {
			ref.current.scrollIntoView({ block: 'center' });
		}
	}, [highlighted]);

	return (
		<div
			ref={ref}
			data-cy={`notification-switch-${entry.id}`}
			className={
				highlighted
					? 'notifications__row notifications__row--highlighted'
					: 'notifications__row'
			}
		>
			{entry.source.kind === 'settings' ? (
				<EmailToggle
					name={`settings.${entry.source.field}`}
					titleKey={entry.titleKey}
					descriptionKey={entry.descriptionKey}
				/>
			) : (
				<EmailTypeToggle
					type={entry.source.type}
					titleKey={entry.titleKey}
					descriptionKey={entry.descriptionKey}
				/>
			)}
		</div>
	);
};

/**
 * A switch backed by `emailToggles` rather than by the settings blob.
 *
 * The patch has to send the whole list back — the endpoint replaces it — so
 * this maps over the existing toggles and flips the one it owns, leaving the
 * others exactly as they were.
 */
const EmailTypeToggle = ({
	type,
	titleKey,
	descriptionKey
}: {
	type: string;
	titleKey: string;
	descriptionKey?: string;
}) => {
	const { t } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const current =
		userData?.emailToggles?.find((toggle) => toggle.name === type)?.state ??
		false;
	const [checked, setChecked] = useState(current);

	useEffect(() => {
		setChecked(current);
	}, [current]);

	const onChange = useCallback(
		(next: boolean) => {
			setChecked(next);
			const emailToggles = [...(userData?.emailToggles ?? [])].map(
				(toggle) =>
					toggle.name === type ? { ...toggle, state: next } : toggle
			);
			apiPatchUserData({ emailToggles })
				.then(reloadUserData)
				.catch(() => {
					// Put the switch back where it was: leaving it in the new
					// position would tell the user a lie about what is stored.
					setChecked(!next);
					addNotification({
						title: t('profile.notifications.toggleError.title'),
						text: t(
							'profile.notifications.toggleError.description'
						),
						notificationType: 'error'
					});
				});
		},
		[addNotification, reloadUserData, t, type, userData?.emailToggles]
	);

	return (
		<Switch
			titleKey={titleKey}
			descriptionKey={descriptionKey}
			onChange={onChange}
			checked={checked}
		/>
	);
};
