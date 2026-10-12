import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

const CompletionSetterContext = createContext<React.Dispatch<
	React.SetStateAction<React.ReactNode>
> | null>(null);
const CompletionContentContext = createContext<React.ReactNode>(null);

/** One account form and its footer share a slot; no document-wide registry. */
export const RegistrationCompletionProvider = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const [content, setContent] = useState<React.ReactNode>(null);
	return (
		<CompletionSetterContext.Provider value={setContent}>
			<CompletionContentContext.Provider value={content}>
				{children}
			</CompletionContentContext.Provider>
		</CompletionSetterContext.Provider>
	);
};

/** Keep the resolver mounted, but place its checkbox beside the final action. */
export const useRegistrationCompletion = (content: React.ReactNode) => {
	const setContent = useContext(CompletionSetterContext);
	useEffect(() => {
		if (!setContent) return;
		setContent(content);
		return () => setContent(null);
	}, [content, setContent]);
	// Standalone account forms (including dialogs) retain their own completion.
	return setContent ? null : content;
};

export const useRegistrationCompletionContent = () =>
	useContext(CompletionContentContext);
