import React from 'react';
import { Loading } from '../app/Loading';

interface LoadingSpinnerProps {}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = () => {
	return <Loading layout="inline" size="small" delayMs={0} />;
};
