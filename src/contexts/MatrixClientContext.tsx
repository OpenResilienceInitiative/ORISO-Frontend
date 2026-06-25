import React, {
	createContext,
	useCallback,
	useContext,
	useMemo,
	type ReactNode
} from 'react';
import type { MatrixLoginData } from '../components/sessionCookie/getMatrixAccessToken';
import {
	matrixClientService,
	type MatrixClientService
} from '../services/matrixClientService';

export type MatrixClientContextValue = {
	service: MatrixClientService;
	initializeClient: (loginData: MatrixLoginData) => void;
	destroyClient: () => Promise<void>;
};

const MatrixClientContext = createContext<MatrixClientContextValue | null>(
	null
);

export const MatrixClientProvider = ({ children }: { children: ReactNode }) => {
	const initializeClient = useCallback((loginData: MatrixLoginData) => {
		matrixClientService.initializeClient(loginData);
	}, []);

	const destroyClient = useCallback(async () => {
		await matrixClientService.logout();
	}, []);

	const value = useMemo(
		() => ({
			service: matrixClientService,
			initializeClient,
			destroyClient
		}),
		[initializeClient, destroyClient]
	);

	return (
		<MatrixClientContext.Provider value={value}>
			{children}
		</MatrixClientContext.Provider>
	);
};

const fallbackValue: MatrixClientContextValue = {
	service: matrixClientService,
	initializeClient: (loginData) =>
		matrixClientService.initializeClient(loginData),
	destroyClient: () => matrixClientService.logout()
};

export const useMatrixClient = (): MatrixClientContextValue => {
	const context = useContext(MatrixClientContext);
	return context ?? fallbackValue;
};

export const useMatrixClientService = (): MatrixClientService => {
	return useMatrixClient().service;
};
