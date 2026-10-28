import * as React from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import { CircularProgress } from '@mui/material';
import { ReactComponent as WaitingIllustration } from '../../resources/img/illustrations/chat-waiting.svg';
import { MyDirectLinks } from '../conversationCreate/directLink/MyDirectLinks';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinksLoadState } from './useMyDirectLinks';
import './myDirectLinksPage.styles.scss';

export interface MyDirectLinksViewProps {
	state: DirectLinksLoadState;
	links: DirectLink[];
	toggleFailed?: boolean;
	onToggle: (id: string, active: boolean) => void;
	onShowQr: (link: DirectLink) => void;
	onEdit: (link: DirectLink) => void;
	onCreate: () => void;
	onRetry: () => void;
	onCopy?: (url: string) => void | Promise<void>;
}

/** The round button: links are only created in "Create chat". */
const CreateButton = ({ onCreate }: { onCreate: () => void }) => {
	const { t } = useTranslation();
	return (
		<button
			type="button"
			className="myDirectLinksPage__create"
			aria-label={t('directLink.page.create')}
			title={t('directLink.page.create')}
			onClick={onCreate}
			data-testid="direct-links-create"
		>
			<AddIcon aria-hidden />
		</button>
	);
};

/** Empty state in the style of the old "Terminübersicht": cup, one line, a way on. */
export const DirectLinksEmptyState = () => {
	const { t } = useTranslation();
	return (
		<div
			className="myDirectLinksPage__empty"
			data-testid="direct-links-empty"
		>
			<WaitingIllustration
				aria-hidden
				className="myDirectLinksPage__illustration"
			/>
			<p className="myDirectLinksPage__emptyHeadline">
				{t('directLink.page.emptyHeadline')}
			</p>
			<p className="myDirectLinksPage__emptyText">
				{t('directLink.page.emptyText')}
			</p>
		</div>
	);
};

/**
 * #1894: "Meine Direktlinks" under the clock entry and in
 * Settings → "Meine Links". Presentational; data comes from useMyDirectLinks.
 */
export const MyDirectLinksView = ({
	state,
	links,
	toggleFailed = false,
	onToggle,
	onShowQr,
	onEdit,
	onCreate,
	onRetry,
	onCopy
}: MyDirectLinksViewProps) => {
	const { t } = useTranslation();

	if (state === 'loading') {
		return (
			<div className="myDirectLinksPage__status" aria-busy="true">
				<CircularProgress
					size={32}
					aria-label={t('directLink.page.loading')}
				/>
			</div>
		);
	}

	if (state === 'failed') {
		return (
			<div className="myDirectLinksPage__status" role="alert">
				<p>{t('directLink.page.loadFailed')}</p>
				<button
					type="button"
					className="myDirectLinksPage__retry"
					onClick={onRetry}
				>
					{t('directLink.page.retry')}
				</button>
			</div>
		);
	}

	return (
		<>
			<MyDirectLinks
				links={links}
				onToggle={onToggle}
				onShowQr={onShowQr}
				onEdit={onEdit}
				onCopy={onCopy}
				headerAction={<CreateButton onCreate={onCreate} />}
				emptyState={<DirectLinksEmptyState />}
			/>
			{toggleFailed && (
				<p role="alert" className="myDirectLinksPage__error">
					{t('directLink.page.toggleFailed')}
				</p>
			)}
		</>
	);
};
