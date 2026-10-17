import React, { useCallback, useContext, useEffect, useState } from 'react';
import { UserDataContext } from '../../../../globalState';
import { Switch } from '../../../Switch';
import { readEmailSetting, useSaveEmailSetting } from '../emailSetting';

interface EmailToggleProps {
	name: string;
	titleKey: string;
	descriptionKey?: string;
}

export const EmailToggle = ({
	name,
	titleKey,
	descriptionKey
}: EmailToggleProps) => {
	const { userData } = useContext(UserDataContext);
	const [internalChecked, setInternalChecked] = useState(false);
	// Shared with the display filter's E-Mail column: one write path.
	const save = useSaveEmailSetting();

	useEffect(() => {
		setInternalChecked(readEmailSetting(userData, { kind: 'path', name }));
	}, [userData.emailNotifications, name]); // eslint-disable-line react-hooks/exhaustive-deps

	const onChange = useCallback(
		async (checked: boolean) => {
			setInternalChecked(checked);
			const { revertTo } = await save({ kind: 'path', name }, checked);
			if (revertTo !== undefined) setInternalChecked(revertTo);
		},
		[name, save]
	);

	return (
		<Switch
			titleKey={titleKey}
			descriptionKey={descriptionKey}
			onChange={onChange}
			checked={internalChecked}
		/>
	);
};
