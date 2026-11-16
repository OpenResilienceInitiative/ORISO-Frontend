import * as React from 'react';
import useTenantTheming from '../../utils/useTenantTheming';
import { Modal } from '../modal/Modal';
import { Spinner } from '../spinner/Spinner';
import { useLoginHandoverActive } from './loginHandover';

export const TenantThemingLoader = () => {
	const isLoadingTheme = useTenantTheming();
	// During a sign-in the login handover screen already covers everything;
	// this white modal over it was the white flash between two red frames.
	const isHandingOver = useLoginHandoverActive();

	return isLoadingTheme && !isHandingOver ? (
		<Modal>
			<div>
				<Spinner isDark />
			</div>
		</Modal>
	) : null;
};
