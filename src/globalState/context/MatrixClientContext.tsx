import * as React from 'react';
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState
} from 'react';
import { MatrixClientService } from '../../services/matrixClientService';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';

export type TMatrixClientContext = {
	matrixClientService: MatrixClientService | null;
	setMatrixClientService: (service: MatrixClientService | null) => void;
};

export const MatrixClientContext = createContext<TMatrixClientContext | null>(
	null
);

type MatrixClientProviderProps = {
	children: React.ReactNode;
};

export function MatrixClientProvider({ children }: MatrixClientProviderProps) {
	const [matrixClientService, setMatrixClientServiceState] =
		useState<MatrixClientService | null>(null);

	const setMatrixClientService = useCallback(
		(service: MatrixClientService | null) => {
			setMatrixClientServiceState(service);
			setMatrixClientServiceRef(service);
		},
		[]
	);

	const value = useMemo(
		() => ({
			matrixClientService,
			setMatrixClientService
		}),
		[matrixClientService, setMatrixClientService]
	);

	return (
		<MatrixClientContext.Provider value={value}>
			{children}
		</MatrixClientContext.Provider>
	);
}

export const useMatrixClient = (): TMatrixClientContext => {
	const context = useContext(MatrixClientContext);
	if (!context) {
		throw new Error(
			'useMatrixClient must be used within MatrixClientProvider'
		);
	}
	return context;
};
