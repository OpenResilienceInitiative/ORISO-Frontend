import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrbitalTrails } from '../orbitalTrails/OrbitalTrails';
import './loading.styles.scss';

export interface LoadingProps {
	layout?: 'page' | 'section' | 'inline';
	size?: 'small' | 'medium' | 'large';
	delayMs?: number;
	label?: string;
	isDark?: boolean;
	className?: string;
}

export const Loading = ({
	layout = 'section',
	size = 'large',
	delayMs = 200,
	label,
	isDark = false,
	className
}: LoadingProps) => {
	const { t } = useTranslation();
	const text = label ?? t('app.wait');
	const [isVisible, setIsVisible] = useState(delayMs === 0);

	useEffect(() => {
		setIsVisible(delayMs === 0);
		if (delayMs === 0) return;
		const timeout = window.setTimeout(() => setIsVisible(true), delayMs);
		return () => window.clearTimeout(timeout);
	}, [delayMs]);

	if (!isVisible) return null;

	return (
		<div
			className={clsx(
				'loading',
				`loading--${layout}`,
				`loading--${size}`,
				className
			)}
			role="status"
			aria-label={text}
			aria-live="polite"
		>
			<div className="loading__animation" aria-hidden="true">
				<OrbitalTrails
					label={text}
					variant="single"
					palette={isDark ? 'neutral' : 'brand'}
					warmupFrames={40}
				/>
			</div>
			<span className="loading__label">{text}</span>
		</div>
	);
};
