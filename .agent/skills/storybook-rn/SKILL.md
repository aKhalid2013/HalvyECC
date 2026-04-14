---
name: storybook-rn
description: >
  Storybook for React Native — per-component stories as a definition of done.
  Use when creating component stories, visual regression tests, or Chromatic
  uploads. Triggers: "storybook", "story", "component stories", "visual regression",
  "chromatic", "component library", "isolated component".
origin: Halvy ECC
sources:
  - https://storybook.js.org/tutorials/intro-to-storybook/react-native/en/get-started/
  - https://www.chromatic.com/docs/react-native
---

# Storybook for React Native — Halvy

## Purpose

Every shared component in `src/components/` requires a story file.
Stories are the definition of done for UI components — before a component is
shipped it must render correctly in isolation across all its states.

## File Structure

```
src/components/
  Button/
    Button.tsx
    Button.stories.tsx    ← Required for every shared component
  ExpenseCard/
    ExpenseCard.tsx
    ExpenseCard.stories.tsx
  BalanceChip/
    BalanceChip.tsx
    BalanceChip.stories.tsx
```

## Story Pattern

```typescript
// src/components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-native';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    onPress: { action: 'pressed' },
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'ghost'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    label: 'Save Expense',
    variant: 'primary',
  },
};

export const Danger: Story = {
  args: {
    label: 'Delete',
    variant: 'danger',
  },
};

export const Loading: Story = {
  args: {
    label: 'Saving...',
    variant: 'primary',
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Unavailable',
    variant: 'primary',
    disabled: true,
  },
};
```

## Financial Component Story Example

```typescript
// src/components/BalanceChip/BalanceChip.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-native';
import { BalanceChip } from './BalanceChip';

const meta: Meta<typeof BalanceChip> = {
  title: 'Finance/BalanceChip',
  component: BalanceChip,
};

export default meta;
type Story = StoryObj<typeof BalanceChip>;

export const Positive: Story = {
  args: { amountCents: 15000, currency: 'EGP' }, // EGP 150.00 owed to me
};

export const Negative: Story = {
  args: { amountCents: -7500, currency: 'EGP' }, // EGP 75.00 I owe
};

export const Zero: Story = {
  args: { amountCents: 0, currency: 'EGP' }, // settled
};
```

## Running Storybook

```bash
# Start the Storybook server
npx expo start --storybook

# Or on web
npx storybook dev --port 6006
```

## Chromatic Visual Regression (CI)

```yaml
# .github/workflows/chromatic.yml
- name: Publish to Chromatic
  uses: chromaui/action@latest
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    buildScriptName: build-storybook
```

## Story Checklist (per component)

- [ ] All visual variants covered (primary, secondary, danger, ghost)
- [ ] Loading state story
- [ ] Disabled/error state story
- [ ] Dark mode story (use `colorScheme: 'dark'` decorator)
- [ ] Financial amounts use `amountCents` not raw numbers

## Component Completion Gate

A shared component is NOT complete until:
1. The component renders without errors
2. All variants have a story
3. The story renders in Storybook without errors
4. Dark mode variant is verified
