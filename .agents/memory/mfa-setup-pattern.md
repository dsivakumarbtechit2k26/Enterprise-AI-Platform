---
name: MFA setup hook pattern
description: How to correctly call MFA setup in React — imperative function vs hook
---

## Rule
For button-triggered one-shot fetches, use the imperative function `getMfaSetup()` directly instead of the `useGetMfaSetup` hook with `enabled: false`.

```typescript
const data = await getMfaSetup();  // returns MfaSetupResponse
```

`MfaSetupResponse` shape: `{ qr_code_url: string; secret: string }` — NO `.data` wrapper.

**Why:** `useGetMfaSetup` is a TanStack Query hook and its `UseQueryOptions` type requires `queryKey` which makes `{ query: { enabled: false } }` a type error. The imperative `getMfaSetup()` is cleaner for setup flows that only happen on button click.

**How to apply:** Same pattern applies to any other one-shot GET that shouldn't auto-fetch. Use the raw async function, not the hook.
