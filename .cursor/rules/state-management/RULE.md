---
description: 'Global state patterns, Context providers, Jotai usage, and state organization for ORISO Frontend'
globs: ['src/globalState/**/*.tsx', 'src/store/**/*.ts', 'src/hooks/**/*.tsx']
---

# State Management

## Overview

ORISO Frontend uses a combination of React Context API and Jotai for state management. Choose the right tool based on state scope and complexity.

## State Management Strategy

### When to Use Each Approach

1. **useState**: Local component state
2. **Context API**: Shared state across multiple components
3. **Jotai**: Simple, isolated state that needs reactivity
4. **Session Storage**: Temporary state (registration data)

## Context API

### Provider Pattern

**Context providers are in `src/globalState/provider/`:**

```typescript
// ✅ Good: Context provider
export const UserDataProvider = ({ children }) => {
	const [userData, setUserData] = useState<UserDataInterface | null>(null);

	const value = {
		userData,
		setUserData
	};

	return (
		<UserDataContext.Provider value={value}>
			{children}
		</UserDataContext.Provider>
	);
};
```

### Provider Composition

**Use ProviderComposer for multiple providers:**

```typescript
// ✅ Good: Provider composition
function ContextProvider({ children }) {
	return (
		<ProviderComposer
			contexts={[
				<ConsultantListProvider />,
				<ConsultingTypesProvider />,
				<NotificationsProvider />,
				<UserDataProvider />,
				<SessionsDataProvider />
			]}
		>
			{children}
		</ProviderComposer>
	);
}
```

**See `src/globalState/state.tsx` for full example.**

### Using Context

**Access context via custom hooks or useContext:**

```typescript
// ✅ Good: Custom hook
const useUserData = () => {
	const context = useContext(UserDataContext);
	if (!context) {
		throw new Error('useUserData must be used within UserDataProvider');
	}
	return context;
};

// Usage
const Component = () => {
	const { userData, setUserData } = useUserData();
	// ...
};
```

### Available Context Providers

**Global state providers:**

- `UserDataProvider` - User information
- `SessionsDataProvider` - Session list
- `NotificationsProvider` - Notifications
- `AppConfigProvider` - App configuration
- `ConsultingTypesProvider` - Consulting types
- `TopicsProvider` - Topics
- `ModalProvider` - Modal state
- `LocaleProvider` - Locale settings
- `TenantProvider` - Tenant information

## Jotai Atoms

### Simple State

**Use Jotai for simple, isolated state:**

```typescript
// ✅ Good: Jotai atom
// src/store/agencyLogoAtom.ts
import { atom } from 'jotai';

export const agencyLogoAtom = atom<string | null>(null);

// Usage in component
import { useAtom } from 'jotai';
import { agencyLogoAtom } from '../../store/agencyLogoAtom';

const Component = () => {
	const [logo, setLogo] = useAtom(agencyLogoAtom);
	// ...
};
```

**When to use Jotai:**

- Simple state that doesn't need provider setup
- State shared between a few components
- Derived state that needs reactivity

## Local State (useState)

### Component-Specific State

**Use useState for component-specific state:**

```typescript
// ✅ Good: Local state
const Component = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [inputValue, setInputValue] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	// ...
};
```

**When to use useState:**

- State only used within one component
- Form input values
- UI state (modals, dropdowns, etc.)
- Temporary state

## Session Storage

### Temporary State

**Use session storage for temporary data:**

```typescript
// ✅ Good: Session storage for registration
const saveRegistrationData = (data: RegistrationData) => {
	sessionStorage.setItem('registrationData', JSON.stringify(data));
};

const loadRegistrationData = (): RegistrationData | null => {
	const data = sessionStorage.getItem('registrationData');
	return data ? JSON.parse(data) : null;
};
```

**When to use session storage:**

- Registration flow data
- Temporary form data
- Data that should be cleared on browser close

## State Organization

### Keep State Close to Usage

**Avoid prop drilling - use Context:**

```typescript
// ❌ Bad: Prop drilling
const App = () => {
	const [userData, setUserData] = useState(null);
	return <ComponentA userData={userData} />;
};

const ComponentA = ({ userData }) => {
	return <ComponentB userData={userData} />;
};

const ComponentB = ({ userData }) => {
	return <ComponentC userData={userData} />;
};

// ✅ Good: Context
const App = () => {
	return (
		<UserDataProvider>
			<ComponentA />
		</UserDataProvider>
	);
};

const ComponentC = () => {
	const { userData } = useUserData();
	// ...
};
```

### State Structure

**Organize related state:**

```typescript
// ✅ Good: Related state grouped
const [formState, setFormState] = useState({
	email: '',
	password: '',
	isValid: false,
	errors: {}
});

// ❌ Bad: Unrelated state separate
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [isValid, setIsValid] = useState(false);
const [errors, setErrors] = useState({});
```

## Context Provider Best Practices

### Provider Structure

```typescript
// ✅ Good: Complete provider
interface UserDataContextInterface {
	userData: UserDataInterface | null;
	setUserData: (data: UserDataInterface | null) => void;
	isLoading: boolean;
}

const UserDataContext = createContext<UserDataContextInterface | undefined>(undefined);

export const UserDataProvider = ({ children }) => {
	const [userData, setUserData] = useState<UserDataInterface | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	// Fetch logic
	useEffect(() => {
		// ...
	}, []);

	const value = {
		userData,
		setUserData,
		isLoading
	};

	return (
		<UserDataContext.Provider value={value}>
			{children}
		</UserDataContext.Provider>
	);
};

export const useUserData = () => {
	const context = useContext(UserDataContext);
	if (!context) {
		throw new Error('useUserData must be used within UserDataProvider');
	}
	return context;
};
```

## Anti-Patterns to Avoid

1. **Prop drilling**: Use Context for deeply nested props
2. **Global state for local state**: Use useState for component-specific state
3. **Context for everything**: Only use Context for shared state
4. **Missing error handling**: Check context exists before use
5. **Unnecessary re-renders**: Memoize context values if needed
6. **State in wrong place**: Keep state as close to usage as possible

## Checklist

When managing state:

- [ ] Right tool chosen (useState vs. Context vs. Jotai)
- [ ] State is as close to usage as possible
- [ ] Context providers properly structured
- [ ] Custom hooks for context access
- [ ] Error handling for missing context
- [ ] No prop drilling
- [ ] Related state grouped together

## References

- `src/globalState/state.tsx` - Provider composition
- `src/globalState/provider/` - Context provider examples
- `src/store/agencyLogoAtom.ts` - Jotai atom example
- `src/hooks/useAppConfig.tsx` - Custom hook example
- `src/globalState/globalState_notes.md` - State documentation
