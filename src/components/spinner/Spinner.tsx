import * as React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { LiveChatChecking } from '../anonymousChat/entryRoom/LiveChatChecking';
import './spinner.styles.scss';

interface SpinnerProps {
	isDark?: boolean;
	className?: string;
}

/** Large page/stage loader; inline control indicators keep their compact API. */
export const Spinner = ({ isDark, className }: SpinnerProps) => {
	const { t } = useTranslation();
	return (
		<div className={clsx('spinner', isDark && 'dark', className)}>
			<LiveChatChecking text={t('app.wait')} />
		</div>
	);
};
