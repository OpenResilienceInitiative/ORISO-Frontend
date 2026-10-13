import * as React from 'react';
import { Loading } from '../app/Loading';

export const LoadingIndicator = () => {
	return (
		<Loading
			layout="inline"
			size="medium"
			delayMs={0}
			className="loadingIndicator"
		/>
	);
};
