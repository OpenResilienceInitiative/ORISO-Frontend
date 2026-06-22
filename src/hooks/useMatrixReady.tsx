import { useState, useEffect } from 'react';
import { ClientEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../globalState/context/MatrixClientContext';
/**
 * Hook to check if Matrix client is initialized and ready for calls.
 * Returns true when Matrix client exists and sync state is 'PREPARED'.
 */
export const useMatrixReady = (): boolean => {
	const { matrixClientService } = useMatrixClient();
	const [isReady, setIsReady] = useState<boolean>(false);

	useEffect(() => {
		if (!matrixClientService) {
			setIsReady(false);
			return;
		}

		const client = matrixClientService.getClient();
		if (!client) {
			setIsReady(false);
			return;
		}

		const updateReady = () => {
			setIsReady(client.getSyncState() === 'PREPARED');
		};

		updateReady();
		client.on(ClientEvent.Sync, updateReady);

		return () => {
			client.removeListener(ClientEvent.Sync, updateReady);
		};
	}, [matrixClientService]);

	return isReady;
};
