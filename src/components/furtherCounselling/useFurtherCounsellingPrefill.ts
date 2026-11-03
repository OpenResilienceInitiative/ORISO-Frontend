import { useContext, useMemo } from 'react';
import { SessionsDataContext } from '../../globalState';
import { ListItemInterface } from '../../globalState/interfaces';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	pickPrefilledPostcode,
	resolvePostcodeMode
} from './furtherCounsellingRules';

/**
 * What the request dialog starts with, from the profile entry and from the
 * recommendation card alike (FE#1876): the postcode per the platform setting
 * and the centres the asker already talks to.
 */
export const useFurtherCounsellingPrefill = () => {
	const sessions = useContext(SessionsDataContext)?.sessions;
	const mode = resolvePostcodeMode(
		useAppConfig()?.furtherCounsellingPostcodeMode
	);
	return useMemo(() => {
		const items: ListItemInterface[] = Object.values(sessions || {}).filter(
			(item: ListItemInterface) => !!item
		);
		return {
			prefilledPostcode: pickPrefilledPostcode(items, mode),
			knownAgencyIds: items
				.map((item) => item?.agency?.id)
				.filter((id): id is number => typeof id === 'number')
		};
	}, [sessions, mode]);
};
