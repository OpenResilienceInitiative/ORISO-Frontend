import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UserDataInterface } from '../interfaces/UserDataInterface';
import { apiGetUserData } from '../../api';
import { UserDataContext } from '../context/UserDataContext';
import { getValueFromCookie } from '../../components/sessionCookie/accessSessionCookie';
import {
	getAuthenticatedAccountIdentity,
	subscribeToAuthenticatedTenant
} from '../../utils/authenticatedTenant';
import { parseJwt } from '../../utils/parseJWT';

export function UserDataProvider(props) {
	const scope = useRef({ identity: getAuthenticatedAccountIdentity() });
	const [snapshot, setSnapshot] = useState<{
		scope: typeof scope.current;
		data: UserDataInterface;
	} | null>(null);
	const latestRequest = useRef<object | null>(null);
	const currentScope = useCallback(() => {
		const identity = getAuthenticatedAccountIdentity();
		if (identity !== scope.current.identity) scope.current = { identity };
		return scope.current;
	}, []);
	// A fresh object per identity transition also distinguishes A → B → A.
	const activeScope = currentScope();
	useEffect(
		() =>
			subscribeToAuthenticatedTenant(() => {
				const previous = scope.current;
				if (currentScope() !== previous) setSnapshot(null);
			}),
		[currentScope]
	);
	const applyUserData = useCallback(
		(data: UserDataInterface) => {
			const active = currentScope();
			const subject = parseJwt(getValueFromCookie('keycloak') ?? '')?.sub;
			if (subject && data?.userId !== subject) return;
			setSnapshot(data ? { scope: active, data } : null);
		},
		[currentScope]
	);
	// A direct write is newer than any reload already in flight.
	const setUserData = useCallback(
		(data: UserDataInterface) => {
			latestRequest.current = null;
			applyUserData(data);
		},
		[applyUserData]
	);
	const reloadUserData = useCallback(() => {
		const requestScope = currentScope();
		const request = {};
		latestRequest.current = request;
		// The last confirmed capability stays while the request is pending, so an
		// unrelated reload cannot interrupt email flows; failure withdraws it.
		return apiGetUserData()
			.then((data: UserDataInterface) => {
				if (
					currentScope() === requestScope &&
					latestRequest.current === request
				)
					applyUserData(data);
				return data;
			})
			.catch((error) => {
				if (
					currentScope() === requestScope &&
					latestRequest.current === request
				)
					setSnapshot((previous) =>
						previous?.scope === requestScope
							? {
									...previous,
									data: {
										...previous.data,
										isAskerEmailCollectionAllowed: false
									}
								}
							: previous
					);
				throw error;
			});
	}, [currentScope, applyUserData]);
	return (
		<UserDataContext.Provider
			value={{
				userData:
					snapshot?.scope === activeScope ? snapshot.data : null,
				setUserData,
				reloadUserData
			}}
		>
			{props.children}
		</UserDataContext.Provider>
	);
}
