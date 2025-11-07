# @carrot-foundation/web-logger

A lightweight logging library for web applications built on top of [Pino](https://github.com/pinojs/pino).

## Installation

```bash
npm install @carrot-foundation/web-logger
```

or

```bash
pnpm add @carrot-foundation/web-logger
```

or

```bash
yarn add @carrot-foundation/web-logger
```

## Usage

```typescript
import { logger } from '@carrot-foundation/web-logger';

// Log messages at different levels
logger.info('Application started');
logger.debug('Debug information');
logger.warn('Warning message');
logger.error('Error occurred');

// Log with additional context
logger.info({ userId: '123', action: 'login' }, 'User logged in');

// Log errors with context
try {
  // some code
} catch (error) {
  logger.error({ error }, 'Operation failed');
}
```

## Features

- Built on top of Pino for high-performance logging
- Simple and intuitive API
- Structured logging support
- Lightweight with minimal dependencies
- ESM module support

## API

The logger instance is a configured Pino logger with all standard Pino methods available:

- `logger.trace()` - Log at trace level
- `logger.debug()` - Log at debug level
- `logger.info()` - Log at info level
- `logger.warn()` - Log at warn level
- `logger.error()` - Log at error level
- `logger.fatal()` - Log at fatal level

For more advanced usage and configuration options, refer to the [Pino documentation](https://getpino.io).

## Repository

[GitHub](https://github.com/carrot-foundation/middle-earth/tree/main/libs/publishable/web/logger)
