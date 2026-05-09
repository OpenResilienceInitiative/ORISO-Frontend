import * as React from 'react';
import { useCallback, useState } from 'react';
import { UserDataInterface } from '../interfaces/UserDataInterface';
import { apiGetUserData } from '../../api';
import { UserDataContext } from '../context/UserDataContext';
import {
	buildAnonymousUserData,
	isAnonymousSession
} from '../../utils/keycloakSession';

export function UserDataProvider(props) {
	const [userData, setUserData] = useState<UserDataInterface | null>(() => {
		if (isAnonymousSession()) {
			return buildAnonymousUserData();
		}
		return null;
	});

	const reloadUserData = useCallback(() => {
		if (isAnonymousSession()) {
			const anonymousUserData = buildAnonymousUserData();
			setUserData(anonymousUserData);
			return Promise.resolve(anonymousUserData);
		}

		return apiGetUserData().then((next: UserDataInterface) => {
			setUserData(next);
			return next;
		});
	}, []);

	return (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData,
				reloadUserData
			}}
		>
			{props.children}
		</UserDataContext.Provider>
	);
}
