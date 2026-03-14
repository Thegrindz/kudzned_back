# Vouches Authentication Fix

## Issue
The create vouch endpoint was returning 401 Unauthorized even with valid JWT tokens, while other endpoints worked fine.

## Root Cause
Two issues were causing the authentication failure:

1. **Missing AuthModule Import**: The vouches and cashout clips modules were not importing the AuthModule, which contains the JWT strategy and configuration needed for authentication.

2. **Incorrect Request Decorator**: The controllers were using `@Request()` instead of `@Req()`, which is the correct decorator used throughout the codebase.

## Fixes Applied

### 1. Added AuthModule Import
Updated both modules to import the AuthModule:

**src/modules/vouches/vouches.module.ts**
```typescript
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // ... other imports
    AuthModule, // Added this
  ],
  // ...
})
```

**src/modules/cashout-clips/cashout-clips.module.ts**
```typescript
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // ... other imports
    AuthModule, // Added this
  ],
  // ...
})
```

### 2. Fixed Request Decorator
Changed all instances of `@Request()` to `@Req()` in both controllers to match the pattern used in working controllers like ProductsController.

**Before:**
```typescript
async create(
  @Request() req: any,
  // ...
)
```

**After:**
```typescript
async create(
  @Req() req: any,
  // ...
)
```

### 3. Updated Imports
Updated the import statements to use `Req` instead of `Request`:

```typescript
import {
  // ... other imports
  Req, // Changed from Request
} from '@nestjs/common';
```

## Why This Fixed the Issue

1. **AuthModule Import**: The JWT strategy needs access to the User repository to validate tokens and retrieve user information. Without importing the AuthModule, the JWT guard couldn't access the strategy and would fail authentication.

2. **Request Decorator**: The `@Req()` decorator is the standard NestJS decorator for accessing the request object, while `@Request()` might not be properly recognized in all contexts.

## Verification
After applying these fixes:
- ✅ JWT authentication now works correctly for all vouches endpoints
- ✅ JWT authentication now works correctly for all cashout clips endpoints
- ✅ No circular dependency issues
- ✅ All other endpoints continue to work as expected

The vouches and cashout clips modules now follow the same authentication pattern as the rest of the application.