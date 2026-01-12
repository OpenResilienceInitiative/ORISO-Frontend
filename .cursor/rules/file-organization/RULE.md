---
description: 'File naming, directory structure, import conventions, and module organization for ORISO Frontend'
alwaysApply: true
---

# File Organization

## Overview

Consistent file organization and naming conventions make the codebase easier to navigate and maintain.

## File Naming Conventions

### Components

**Component files use PascalCase:**

```
src/components/button/Button.tsx
src/components/inputField/InputField.tsx
src/components/modal/Modal.tsx
```

### Style Files

**Style files use camelCase:**

```
src/components/button/button.styles.scss
src/components/inputField/inputField.styles.scss
src/components/box/box.module.scss  (CSS modules)
```

### Utilities

**Utility files use camelCase:**

```
src/utils/generateCsrfToken.ts
src/utils/validateInputValue.ts
src/utils/dateHelpers.ts
```

### Hooks

**Hook files use camelCase with "use" prefix:**

```
src/hooks/useAppConfig.tsx
src/hooks/useSession.tsx
src/hooks/useMatrixReady.tsx
```

### API Functions

**API files use camelCase with "api" prefix:**

```
src/api/apiGetUserData.ts
src/api/apiPostRegistration.ts
src/api/apiPutEmail.ts
```

### Services

**Service files use camelCase:**

```
src/services/matrixClientService.ts
src/services/matrixCallService.ts
src/services/liveKitService.ts
```

## Directory Structure

### Component Organization

**Components organized by feature:**

```
src/components/
├── button/
│   ├── Button.tsx
│   └── button.styles.scss
├── inputField/
│   ├── InputField.tsx
│   └── inputField.styles.scss
└── message/
    ├── Message.tsx
    ├── MessageList.tsx
    └── message.styles.scss
```

### Container Organization

**Containers organized by page/feature:**

```
src/containers/
├── bookings/
│   ├── BookingsList.tsx
│   └── BookingForm.tsx
├── overview/
│   └── Overview.tsx
└── registration/
    └── Registration.tsx
```

### API Organization

**API functions organized by action:**

```
src/api/
├── apiGetUserData.ts
├── apiPostRegistration.ts
├── apiPutEmail.ts
└── appointments/
    └── apiGetAppointments.ts
```

### Global State Organization

**Global state organized by concern:**

```
src/globalState/
├── provider/
│   ├── UserDataProvider.tsx
│   └── SessionsDataProvider.tsx
├── interfaces/
│   └── UserDataInterface.ts
└── state.tsx
```

## Import Organization

### Import Order

**Imports should be organized in this order:**

1. React and React-related
2. Third-party libraries
3. Internal components
4. Internal utilities/hooks
5. Types/interfaces
6. Styles

```typescript
// ✅ Good: Organized imports
// 1. React
import * as React from 'react';
import { useState, useEffect } from 'react';

// 2. Third-party
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

// 3. Internal components
import { Button } from '../button/Button';
import { Text } from '../text/Text';

// 4. Internal utilities/hooks
import { useAppConfig } from '../../hooks/useAppConfig';
import { generateCsrfToken } from '../../utils/generateCsrfToken';

// 5. Types/interfaces
import { UserDataInterface } from '../../globalState/interfaces';

// 6. Styles
import './component.styles';
```

### Import Paths

**Use relative paths for internal imports:**

```typescript
// ✅ Good: Relative paths
import { Button } from '../button/Button';
import { useAppConfig } from '../../hooks/useAppConfig';

// ❌ Bad: Absolute paths from src (not configured)
import { Button } from 'components/button/Button';
```

## File Structure

### Component File Structure

**Component files follow this structure:**

```typescript
// 1. Imports
import * as React from 'react';
// ... other imports

// 2. Types/interfaces
interface ComponentProps {
	// ...
}

// 3. Helper functions
const helperFunction = () => {
	// ...
};

// 4. Subcomponents
const SubComponent = () => {
	// ...
};

// 5. Main component
export const Component = (props: ComponentProps) => {
	// ...
};
```

### Export Patterns

**Use named exports for components:**

```typescript
// ✅ Good: Named export
export const Button = (props: ButtonProps) => {
	// ...
};

// ❌ Bad: Default export (not used in this project)
export default Button;
```

**Exception: Lazy-loaded components may use default export wrapper:**

```typescript
// ✅ Good: Lazy loading wrapper
const Registration = lazy(() =>
	import('./components/registration/Registration').then((m) => ({
		default: m.Registration
	}))
);
```

## Module Organization

### Co-location

**Related files should be co-located:**

```
src/components/button/
├── Button.tsx          # Component
├── button.styles.scss  # Styles
└── Button.test.tsx     # Tests (if any)
```

### Index Files

**Use index files for clean imports:**

```typescript
// src/components/button/index.ts
export { Button } from './Button';
export type { ButtonProps, ButtonItem } from './Button';

// Usage
import { Button } from '../button'; // Clean import
```

## Naming Consistency

### Component Names

**Component names match file names:**

```
Button.tsx → export const Button
InputField.tsx → export const InputField
Modal.tsx → export const Modal
```

### Interface Names

**Interface names follow pattern:**

```
ComponentNameProps     # Component props
ComponentNameItem      # Item interface
ComponentNameState     # State interface
```

### Constant Names

**Constants use UPPER_SNAKE_CASE:**

```typescript
export const BUTTON_TYPES = {
	PRIMARY: 'PRIMARY',
	SECONDARY: 'SECONDARY'
};

export const FETCH_METHODS = {
	GET: 'GET',
	POST: 'POST'
};
```

## File Size Guidelines

### Component Files

**Keep component files focused:**

- Single responsibility
- Under 500 lines when possible
- Extract subcomponents if needed

### Utility Files

**Keep utilities focused:**

- One utility per file
- Related utilities can be grouped
- Clear, descriptive names

## Anti-Patterns to Avoid

1. **Inconsistent naming**: Follow naming conventions
2. **Deep nesting**: Keep directory depth reasonable
3. **Mixed imports**: Organize imports properly
4. **Large files**: Break into smaller modules
5. **Circular dependencies**: Avoid circular imports
6. **Scattered files**: Co-locate related files

## Checklist

When creating files:

- [ ] File naming follows conventions
- [ ] File location is appropriate
- [ ] Imports are organized correctly
- [ ] File structure follows pattern
- [ ] Exports use named exports
- [ ] Related files are co-located
- [ ] File size is reasonable

## References

- `src/components/` - Component organization examples
- `src/api/` - API organization examples
- `src/utils/` - Utility organization examples
- `src/hooks/` - Hook organization examples
