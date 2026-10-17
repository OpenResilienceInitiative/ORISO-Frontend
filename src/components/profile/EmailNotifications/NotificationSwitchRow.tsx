import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { UserDataContext } from '../../../globalState';
import { Switch } from '../../Switch';
import { readEmailSetting, useSaveEmailSetting } from './emailSetting';
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
			// Focus, not only scroll: keyboard and screen-reader users land on
			// the switch itself and hear its name (#872).
			ref.current
				.querySelector<HTMLInputElement>('input[role="switch"]')
				?.focus({ preventScroll: true });
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
 * A switch backed by `emailToggles` rather than by the settings blob. Saved
 * through the shared write path (`emailSetting.ts`), which sends the whole
 * list back with only this toggle flipped.
 */
const EmailTypeToggle = ({
	type,
	titleKey,
	descriptionKey
}: {
	type: UserService.Schemas.EmailType;
	titleKey: string;
	descriptionKey?: string;
}) => {
	const { userData } = useContext(UserDataContext);
	const save = useSaveEmailSetting();
	const current = readEmailSetting(userData, { kind: 'emailToggle', type });
	const [checked, setChecked] = useState(current);

	useEffect(() => {
		setChecked(current);
	}, [current]);

	const onChange = useCallback(
		async (next: boolean) => {
			setChecked(next);
			const { saved, stored } = await save(
				{ kind: 'emailToggle', type },
				next
			);
			if (!saved) {
				// Put the switch back to what is stored: leaving it in the new
				// position would tell the user a lie about what is stored.
				setChecked(stored);
			}
		},
		[save, type]
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
