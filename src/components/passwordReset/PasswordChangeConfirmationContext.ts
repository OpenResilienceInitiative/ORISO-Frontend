import { createContext } from 'react';

export const PasswordChangeConfirmationContext = createContext<
	((loginPath: string) => void) | null
>(null);
