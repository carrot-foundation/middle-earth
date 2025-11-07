# @carrot-foundation/web-ui

A modern React UI component library built with Material-UI (MUI) and Next.js, designed for the Carrot Foundation web applications.

## Installation

```bash
npm install @carrot-foundation/web-ui
```

or

```bash
pnpm add @carrot-foundation/web-ui
```

or

```bash
yarn add @carrot-foundation/web-ui
```

## Peer Dependencies

This package requires React 19.2.0 or higher as a peer dependency.

## Features

- Pre-configured Material-UI theme with custom design tokens
- Reusable React components following atomic design principles
- Built-in sharing functionality for social media platforms
- Next.js optimized with client-side rendering support
- TypeScript support
- ESM module support

## Components

### Atoms

#### Button

A Material-UI button component with custom styling.

```tsx
import { Button } from '@carrot-foundation/web-ui';

<Button variant="contained" color="primary">
  Click me
</Button>;
```

#### Icons

- `ShareIcon` - Share icon component
- `CloseIcon` - Close icon component

```tsx
import { ShareIcon, CloseIcon } from '@carrot-foundation/web-ui';

<ShareIcon sx={{ color: 'primary.main' }} />
<CloseIcon />
```

### Molecules

#### Share

A comprehensive sharing component that provides native share functionality on mobile devices and a custom dialog with social media sharing options on desktop.

```tsx
import { Share } from '@carrot-foundation/web-ui';

<Share title="Check this out!" text="This is an amazing article" url="https://example.com" imageUrl="https://example.com/image.jpg" color="primary.1000" />;
```

Features:

- Native Web Share API integration for mobile devices
- Desktop-optimized dialog with social media sharing buttons
- Support for LinkedIn, X (Twitter), Facebook, and WhatsApp
- Instagram link integration
- Copy-to-clipboard functionality for sharing URLs
- Automatic device detection (mobile vs. desktop)
- Optional image sharing on supported platforms

Props:

- `title?: string` - Title for the shared content
- `text?: string` - Description text for the share
- `url?: string` - URL to share (defaults to current page URL)
- `imageUrl?: string` - Optional image URL to include in the share (mobile only)
- `color?: string` - Custom color for the share icon (default: 'primary.1000')
- `CustomIcon?: Component` - Optional custom icon component to replace the default ShareIcon

### Theme

#### ThemeProvider

Wraps your application with the custom Carrot Foundation theme.

```tsx
import { ThemeProvider } from '@carrot-foundation/web-ui';

function App() {
  return <ThemeProvider>{/* Your app components */}</ThemeProvider>;
}
```

#### Theme Object

The pre-configured theme includes:

- Custom color palette
- Typography settings
- Border radius configurations
- Shadow definitions
- Component-specific styling overrides

```tsx
import { theme } from '@carrot-foundation/web-ui';

// Use the theme object directly if needed
console.log(theme.palette.primary);
```

## Usage Example

```tsx
import { ThemeProvider, Button, Share } from '@carrot-foundation/web-ui';

function MyApp() {
  return (
    <ThemeProvider>
      <div>
        <h1>My Application</h1>
        <Button variant="contained">Get Started</Button>
        <Share title="Check out my app!" url={window.location.href} />
      </div>
    </ThemeProvider>
  );
}
```

## Dependencies

This library uses the following major dependencies:

- `@mui/material` - Material-UI component library
- `@mui/lab` - Material-UI lab components
- `react-share` - Social media sharing components
- `react-social-icons` - Social media icons
- `react-use` - React hooks library
- `next` - Next.js framework
- `@carrot-foundation/web-logger` - Internal logging utility

## Development

This package is part of the Carrot Foundation monorepo and uses:

- TypeScript for type safety
- SWC for fast compilation
- ESLint for code quality
- Nx for build orchestration

## Repository

[GitHub](https://github.com/carrot-foundation/middle-earth/tree/main/libs/publishable/web/ui)
