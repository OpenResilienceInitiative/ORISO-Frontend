/**
 * The supervision side room's people (FE#2344), handed to the messages of
 * that room only. A message whose author is listed here shows the person's
 * name and avatar exactly as the panel header does. Outside the side room
 * the context is empty and every message keeps its own rules.
 */
import { createContext, useContext } from 'react';
import type { SupervisionPeople, SupervisionPerson } from './supervisionPeople';

const EMPTY: SupervisionPeople = new Map();

export const SupervisionPeopleContext = createContext<SupervisionPeople>(EMPTY);

export const useSupervisionPerson = (
	matrixUserId?: string | null
): SupervisionPerson | null => {
	const people = useContext(SupervisionPeopleContext);
	return (matrixUserId && people.get(matrixUserId)) || null;
};
