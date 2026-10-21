import { useCallback, useContext, useState } from 'react';
import { apiPutEmail } from '../api';
import { apiPatchUserData } from '../api/apiPatchUserData';
import { UserDataContext } from '../globalState';
import { UserDataInterface } from '../globalState/interfaces';
import { useAccountOperationActions } from './useAccountOperationActions';
import { endpoints } from '../resources/scripts/endpoints';

interface UserMutateOptions {
	onSuccess?: () => void;
	onError?: (err: Error) => void;
}

export const useUserMutate = ({ onError, onSuccess }: UserMutateOptions) => {
	const { reloadUserData } = useContext(UserDataContext);
	const actions = useAccountOperationActions();
	const [responseData, setResponseData] = useState<Error | null>(null);
	const [error, setError] = useState<Error | null>(null);
	const [requesting, setRequesting] = useState(false);

	const mutate = useCallback(
		(data: Partial<UserDataInterface>) => {
			setRequesting(true);

			const basePromise = data.email
				? actions.run('email', endpoints.email, data.email, apiPutEmail)
				: actions.run(
						'profile',
						endpoints.userData,
						data,
						apiPatchUserData
					);
			basePromise
				.then(setResponseData)
				.then(onSuccess)
				.catch((error) => {
					setError(error);
					onError?.(error);
				})
				// to ensure that we always get the latest data even when it fails we reload
				.then(reloadUserData)
				.finally(() => {
					setRequesting(false);
				});
		},
		[actions, onError, onSuccess, reloadUserData]
	);

	const onAccountEdit = useCallback(() => {
		actions.edited('email', endpoints.email);
		actions.edited('profile', endpoints.userData);
	}, [actions]);
	return {
		onAccountEdit,
		loading: requesting,
		error,
		data: responseData,
		mutate
	};
};
