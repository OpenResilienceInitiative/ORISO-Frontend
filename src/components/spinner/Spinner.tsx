import '../../polyfill';
import * as React from 'react';
import { Loading } from '../app/Loading';

interface SpinnerProps {
	isDark?: boolean;
	className?: string;
}

export const Spinner = ({ isDark, className }: SpinnerProps) => {
	return (
		<Loading
			layout="section"
			size="large"
			delayMs={0}
			isDark={isDark}
			className={className}
		/>
	);
};
