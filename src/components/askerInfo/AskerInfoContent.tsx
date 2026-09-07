import * as React from 'react';
import { useContext } from 'react';
import { TenantContext } from '../../globalState';
import { AskerInfoData } from './AskerInfoData';
import '../profile/profile.styles';
import './askerInfo.styles';
import { AskerInfoTools } from './AskerInfoTools';
import { Box } from '../box/Box';

export const AskerInfoContent = () => {
	const { tenant } = useContext(TenantContext);

	return (
		<>
			<Box>
				<AskerInfoData />
			</Box>
			{tenant?.settings?.featureToolsEnabled && (
				<Box>
					<AskerInfoTools />
				</Box>
			)}
		</>
	);
};
