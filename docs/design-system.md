# EMCP design system

The design system has three compatible layers: semantic tokens in
`css/tokens.css`, reusable component states in `css/components.css`, and the
application layouts in `css/styles.css`. Existing class names remain supported
while new UI can opt into the `ui-*` primitives.

## Foundations

- Use semantic colour, spacing, type, radius, motion, focus and target-size
  tokens instead of component-specific raw values.
- Interactive controls have a 44px target, visible keyboard focus,
  disabled/busy states and responsive touch behaviour.
- Decorative icons are hidden from assistive technology. Meaningful icons need
  a translated accessible name.
- Feedback uses live `status` or assertive `alert` semantics as appropriate.

## Bilingual and accessibility contract

Every user-facing string must have matching Turkish and English entries. Use
`data-i18n`, `data-i18n-placeholder`, or `data-i18n-aria`; the i18n layer also
updates the document language. Inputs need programmatic labels, dialogs must
have an accessible name and managed focus, cards that act as controls must be
native buttons, and motion must respect `prefers-reduced-motion`.

WCAG 2.2 A/AA automated checks run in both languages and at desktop and mobile
breakpoints. Keyboard journeys, dialog focus restoration, labelled inputs,
contrast and reduced motion are also protected by browser regression tests.
