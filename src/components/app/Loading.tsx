import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Spinner } from '../spinner/Spinner';
import { LoadingIndicator } from '../loadingIndicator/LoadingIndicator';
import './loading.styles.scss';

export const Loading = ({ compact = false }: { compact?: boolean }) => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		// Avoid flashing on fast loads; completion is owned by the mounting caller.
		const timeoutId = setTimeout(() => setIsVisible(true), 200);
		return () => clearTimeout(timeoutId);
	}, []);

	return (
		<div
			className={clsx('loading', isVisible && 'loading--visible')}
			aria-hidden={!isVisible}
		>
			{compact ? <LoadingIndicator /> : <Spinner />}
		</div>
	);
};
