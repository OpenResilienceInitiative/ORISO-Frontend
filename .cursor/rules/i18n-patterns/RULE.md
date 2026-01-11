---
description: 'Internationalization patterns, translation keys, WebLate integration, and locale handling for ORISO Frontend'
globs: ['src/resources/i18n/**/*.json', 'src/**/*i18n*.ts', 'src/**/*i18n*.tsx']
---

# i18n Patterns

## Overview

ORISO Frontend uses i18next with WebLate integration for internationalization. All user-facing text must be translated.

## Translation Keys

### Key Structure

**Use dot notation for nested keys:**

```json
// ✅ Good: Nested keys
{
	"login": {
		"title": "Login",
		"email": {
			"label": "Email",
			"placeholder": "Enter your email"
		},
		"password": {
			"label": "Password",
			"show": "Show password",
			"hide": "Hide password"
		}
	}
}
```

### Key Naming

**Use descriptive, hierarchical names:**

```typescript
// ✅ Good: Descriptive keys
t('login.email.label');
t('login.password.show');
t('error.api.generic');

// ❌ Bad: Vague keys
t('text1');
t('message');
t('error');
```

## Using Translations

### useTranslation Hook

**Use useTranslation hook in components:**

```typescript
// ✅ Good: useTranslation hook
import { useTranslation } from 'react-i18next';

const Component = () => {
	const { t } = useTranslation();

	return (
		<div>
			<h1>{t('login.title')}</h1>
			<button>{t('login.submit')}</button>
		</div>
	);
};
```

### Translation Function Alias

**Use alias for clarity:**

```typescript
// ✅ Good: Alias for clarity
const { t: translate } = useTranslation();

<button>{translate('login.submit')}</button>
```

## Translation Namespaces

### Namespace Structure

**Project uses multiple namespaces:**

- `common` - Common translations
- `consultingTypes` - Consulting type specific
- `agencies` - Agency specific
- `languages` - Language names

### Loading Namespaces

**Namespaces loaded automatically:**

```typescript
// ✅ Good: Namespace usage
const { t } = useTranslation('common');
t('login.title'); // Uses 'common' namespace

// Multiple namespaces
const { t } = useTranslation(['common', 'consultingTypes']);
t('common:login.title');
t('consultingTypes:addiction.title');
```

## WebLate Integration

### Translation Sync

**WebLate integration configured in `src/i18n.ts`:**

```typescript
// WebLate configuration
backend: {
	loadPath: `${weblate.host}${weblate.path}/translations/${project}/{{ns}}/{{lng}}/file.json`;
}
```

### Translation Percentage

**Only load translations above threshold:**

```typescript
// Translations loaded if >= percentage threshold
translated_percent >= translation.weblate.percentage;
```

## Locale Handling

### Supported Languages

**Languages configured per tenant:**

```typescript
// Supported languages from config
const supportedLanguages = ['de', 'de@informal', 'en', 'tr'];
```

### Language Detection

**Language detection order:**

1. User selection (stored in LocaleProvider)
2. Browser language
3. Fallback to German (`de`)

### Formal vs Informal

**Support for formal/informal variants:**

- `de` - Formal German
- `de@informal` - Informal German

**Fallback chain:**

- `de@informal` → `de` → `de` (default)

## Translation Files

### File Structure

**Translation files in `src/resources/i18n/`:**

```
src/resources/i18n/
├── de/
│   ├── common.json
│   └── languages.json
├── de@informal/
│   └── common.json
└── en/
    └── common.json
```

### Translation Format

**JSON structure:**

```json
{
	"login": {
		"title": "Anmelden",
		"email": {
			"label": "E-Mail",
			"placeholder": "E-Mail-Adresse eingeben"
		}
	}
}
```

## Dynamic Translations

### Interpolation

**Use interpolation for dynamic values:**

```typescript
// ✅ Good: Interpolation
t('welcome.message', { name: userName });

// Translation: "Welcome, {{name}}!"
```

### Pluralization

**Handle pluralization:**

```typescript
// ✅ Good: Pluralization
t('messages.count', { count: messageCount });

// Translation:
// "one": "{{count}} message",
// "other": "{{count}} messages"
```

## Translation Validation

### Missing Keys Check

**Translation validation enabled:**

```typescript
// Checks for missing keys in development
if (process.env.REACT_APP_ENABLE_TRANSLATION_CHECK === '1') {
	// Validate translation keys
}
```

### Formal Language Check

**Validates informal language doesn't contain formal forms:**

```typescript
// Checks for "Sie", "Ihr" in informal translations
if (lng.indexOf('@informal') >= 0) {
	// Validate no formal language
}
```

## Examples from Codebase

### Button Component

See `src/components/button/Button.tsx`:

```typescript
const { t: translate } = useTranslation();
{
	item.label && translate(item.label);
}
```

### InputField Component

See `src/components/inputField/InputField.tsx`:

```typescript
const { t: translate } = useTranslation();
<HidePasswordIcon
	aria-label={translate('login.password.hide')}
	title={translate('login.password.hide')}
/>
```

## Anti-Patterns to Avoid

1. **Hardcoded strings**: Always use translation keys
2. **Vague keys**: Use descriptive, hierarchical keys
3. **Missing translations**: Check all keys exist
4. **No namespace**: Use appropriate namespace
5. **Untranslated content**: All user-facing text must be translated

## Checklist

When adding translations:

- [ ] All user-facing text uses translation keys
- [ ] Translation keys are descriptive and hierarchical
- [ ] Appropriate namespace used
- [ ] Interpolation used for dynamic values
- [ ] Pluralization handled correctly
- [ ] Translation files updated
- [ ] WebLate sync configured (if applicable)

## References

- `src/i18n.ts` - i18next configuration
- `src/resources/i18n/` - Translation files
- `src/components/button/Button.tsx` - Translation usage example
- i18next documentation
- WebLate documentation
