import { TProvidedLegalLink } from '../../globalState/provider/LegalLinksProvider';
import { useTranslation } from 'react-i18next';
import { Fragment, ReactNode } from 'react';
import * as React from 'react';

const LegalLinks = ({
	legalLinks,
	prefix,
	suffix,
	delimiter,
	lastDelimiter,
	children,
	params,
	filter
}: {
	legalLinks: TProvidedLegalLink[];
	prefix?: ReactNode;
	suffix?: ReactNode;
	delimiter?: ReactNode;
	lastDelimiter?: string;
	params?: { [key: string]: string | number };
	/**
	 * `rawLabel` is the untranslated i18n key. It is the only stable identifier
	 * a caller can match an entry on — the translated label changes with the UI
	 * language and the URL is deployment configuration.
	 */
	children?: (label: string, url: string, rawLabel: string) => ReactNode;
	filter?: (legalLink: TProvidedLegalLink) => boolean;
}) => {
	const { t: translate } = useTranslation();

	const getPrefix = (i: number, lastIndex: number) => {
		if (i === 0) {
			return prefix;
		} else if (i === lastIndex && lastDelimiter) {
			return lastDelimiter;
		}

		return delimiter;
	};
	const getSuffix = (i: number, lastIndex: number) =>
		i === lastIndex && suffix;

	const links = legalLinks
		.filter(filter || (() => true))
		.map(({ label, getUrl }) => ({
			label: translate(label),
			rawLabel: label,
			url: getUrl(params || {})
		}))
		.reduce((links, { label, rawLabel, url }, i, b) => {
			links.push(
				<Fragment key={url}>
					{getPrefix(i, b.length - 1)}
					{children ? (
						children(label, url, rawLabel)
					) : (
						<a target="_blank" rel="noreferrer" href={url}>
							{label}
						</a>
					)}
					{getSuffix(i, b.length - 1)}
				</Fragment>
			);
			return links;
		}, [] as ReactNode[]);

	return <>{links}</>;
};

export default LegalLinks;
