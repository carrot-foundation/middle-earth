---
title: 'Naming Conventions'
description: 'Case formatting rules for domain-specific identifiers and general naming patterns'
category: 'code-quality'
priority: 'required'
appliesTo: ['typescript', 'javascript', 'solidity', 'all']
tools: ['cursor', 'claude', 'copilot', 'all']
version: '1.1.1'
lastUpdated: '2026-01-12'
relatedRules: ['code-style.md', 'typescript.md']
---

# Naming Conventions

This document defines case formatting rules for domain-specific identifiers and general naming patterns across Carrot Foundation projects.

## General Naming Patterns

### Case Formatting by Context

- **PascalCase** (`PascalCase`): Types, classes, interfaces, enum names, event names
- **camelCase** (`camelCase`): Variables, properties, function parameters, method names
- **kebab-case** (`kebab-case`): File and directory names, domain scopes in commits, branch names, URL paths, CLI options
- **SCREAMING_SNAKE_CASE** (`SCREAMING_SNAKE_CASE`): Constants, environment variables, enum keys

## Domain-Specific Identifiers

### MassID Naming Patterns

#### PascalCase: `MassID`

Use **PascalCase** (`MassID`) for:

- **Types and Interfaces**: `MassIDSpecification`, `MassIDSummaryDto`, `MassIDTokenizationPrepareService`
- **Classes**: `MassIDTokenizationPrepareModule`, `MassIDTokenizationMintNftService`
- **Enum Names**: `ApiMethodologyMassIDCertificateType`
- **Domain References in Prose**: "MassID tokenization workflows", "MassID certificate issuance"
- **Event Names**: `MassIDMinted`, `MassIDTokenized`

Examples:

```typescript
export type MassIDSpecification = 'basic' | 'bold';
export interface MassIDSummaryDto {
  documentId: PalantirDocumentId;
}
export class MassIDTokenizationPrepareService {}
```

```solidity
event MassIDMinted(uint256 indexed tokenId, string tokenURI);
```

#### camelCase: `massID`

Use **camelCase** (`massID`) for:

- **Variables**: `const massID = ...`
- **Properties**: `massIDDocumentId`, `massIDTokenId`, `massIDCount`
- **Function Parameters**: `massIDCertificateDocumentId`, `massIDAddress`
- **Method/Property Names**: `setMassIDCommandOptions()`, `findByMassIDCertificateDocumentId()`

Examples:

```typescript
const massID: MassIDSpecification = 'bold';
interface Dto {
  massIDDocumentId: NonEmptyString;
  massIDCertificateDocumentIds: NonEmptyArray<NonEmptyString>;
}
function findByMassIDCertificateDocumentId(massIDCertificateDocumentId: string) {}
```

```solidity
struct OriginInfo {
  uint256 massIDTokenId;
}
```

#### kebab-case: `mass-id`

Use **kebab-case** (`mass-id`) for:

- **File and Directory Names**: `mass-id.ts`, `mass-id-certificate.ts`, `mass-id-audit/`
- **Domain Scopes in Commits**: `feat(mass-id/app): add tokenization queue`
- **Branch Names**: `feat/mass-id-add-tokenization-queue`
- **URL Paths and Routes**: `/api/mass-id/search`
- **CLI Options**: `--mass-id-token-id`

Examples:

```text
# Commit scope
feat(mass-id/app): add tokenization queue worker

# Branch name
feat/mass-id-add-tokenization-queue

# File paths
libs/apps/mass-id/tokenization/prepare/
apps/mass-id/tokenization/finalize/service/
```

#### SCREAMING_SNAKE_CASE: `MASS_ID`

Use **SCREAMING_SNAKE_CASE** (`MASS_ID`) for:

- **Constants**: `const MASS_ID_TOKEN_ID = ...`
- **Environment Variables**: `MASS_ID_TOKEN_ID`, `MASS_ID_ADDRESS`
- **Enum Keys** (if applicable): `MASS_ID_CERTIFICATE_TYPE`

Examples:

```typescript
const MASS_ID_TOKEN_ID = '0x123...';
process.env.MASS_ID_ADDRESS;
```

### GasID and RecycledID Naming Patterns

#### PascalCase: `GasID` and `RecycledID`

Use **PascalCase** (`GasID`, `RecycledID`) for:

- **Enum Names**: `PalantirMassIDCertificateType`, `ApiMethodologyMassIDCertificateType`
- **Enum Values as String Literals**: `'GasID'`, `'RecycledID'`
- **Type Literals**: `'GasID' | 'RecycledID'`
- **Domain References in Prose**: "GasID certificate type", "RecycledID methodology"

Examples:

```typescript
export enum PalantirMassIDCertificateType {
  GAS_ID = 'GasID',
  RECYCLED_ID = 'RecycledID',
}

export type MassIDCertificateType = 'GasID' | 'RecycledID';

interface CreateMethodologyDto {
  massIDCertificateType: 'GasID' | 'RecycledID';
}
```

#### SCREAMING_SNAKE_CASE: `GAS_ID` and `RECYCLED_ID`

Use **SCREAMING_SNAKE_CASE** (`GAS_ID`, `RECYCLED_ID`) for:

- **Enum Keys**: `GAS_ID = 'GasID'`, `RECYCLED_ID = 'RecycledID'`
- **Constants**: `const GAS_ID_CERTIFICATE_TYPE = 'GasID'`

Examples:

```typescript
export enum PalantirMassIDCertificateType {
  GAS_ID = 'GasID',
  RECYCLED_ID = 'RecycledID',
}
```

## Quick Reference Table

| Context                             | MassID                             | GasID/RecycledID                               | Example                                       |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| **Types/Classes/Interfaces**        | `MassID` (PascalCase)              | `GasID`, `RecycledID` (PascalCase)             | `MassIDSpecification`, `GasID`                |
| **Variables/Properties/Parameters** | `massID` (camelCase)               | N/A                                            | `massIDDocumentId`                            |
| **Files/Directories/Scopes**        | `mass-id` (kebab-case)             | N/A                                            | `mass-id-certificate.ts`, `feat(mass-id/app)` |
| **Constants/Env Vars**              | `MASS_ID` (SCREAMING_SNAKE_CASE)   | `GAS_ID`, `RECYCLED_ID` (SCREAMING_SNAKE_CASE) | `MASS_ID_TOKEN_ID`, `GAS_ID = 'GasID'`        |
| **Enum Keys**                       | `MASS_ID_*` (SCREAMING_SNAKE_CASE) | `GAS_ID`, `RECYCLED_ID` (SCREAMING_SNAKE_CASE) | `GAS_ID = 'GasID'`                            |
| **Enum Values (String Literals)**   | `'MassID'` (PascalCase)            | `'GasID'`, `'RecycledID'` (PascalCase)         | `GAS_ID = 'GasID'`                            |

## Common Mistakes to Avoid

❌ **Incorrect**:

```typescript
// Wrong: Mixed case in type name
type MassIdSpecification = 'basic' | 'bold';

// Wrong: Mixed case in variable
const massIdDocumentId = ...;

// Wrong: PascalCase in file name
MassIdCertificate.ts

// Wrong: camelCase in enum value
GAS_ID = 'gasID'
```

✅ **Correct**:

```typescript
// Correct: PascalCase for types
type MassIDSpecification = 'basic' | 'bold';

// Correct: camelCase for variables
const massIDDocumentId = ...;

// Correct: kebab-case for file names
mass-id-certificate.ts

// Correct: PascalCase for enum values
GAS_ID = 'GasID'
```

## Integration with General Naming Rules

These domain-specific conventions complement the general naming rules:

- **TypeScript**: Follow standard TypeScript naming (PascalCase for types, camelCase for variables)
- **Solidity**: Follow Solidity naming conventions (PascalCase for contracts/structs, camelCase for variables)
- **Files**: Follow kebab-case for file names (consistent with project standards)
- **Commits/Branches**: Follow kebab-case for scopes and branch names

See:

- `.ai/categories/code-quality/code-style.md` for general code style conventions
- `.ai/categories/code-quality/typescript.md` for TypeScript naming conventions
- Project-specific Solidity rules for Solidity naming conventions
