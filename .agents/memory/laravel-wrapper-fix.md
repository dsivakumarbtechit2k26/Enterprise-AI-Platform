---
name: Laravel response wrapper and API client customFetch
description: The generated customFetch does NOT unwrap Laravel's { data, message } envelope
---

## Rule
Laravel wraps all responses as `{ data: T, message?: "..." }`. The generated `customFetch<T>` returns this raw object — it does NOT unwrap `data`. This means:
- If a function does `customFetch<User>()` and Laravel returns `{ data: User }`, you get `{ data: User }`, not `User`.

## What was fixed
`login`, `register`, `getMe` functions in `api.ts` were patched to use `customFetch<{ data: T }>` and return `response.data`.

## Pattern for future functions
If a generated API function's response shape doesn't match what the component expects, check whether the Laravel endpoint wraps in `data`. If so, either:
1. Patch the generated function to return `response.data`
2. Or change the Laravel endpoint to NOT wrap in `data` (match the TypeScript type directly)

**How to apply:** The billing endpoints (`subscription`, `plans`, `checkout`, `portal`, `invoices`) now return shapes that match TypeScript types WITHOUT any `data` wrapper (except `PlanListResponse.data[]` and `InvoiceListResponse.data[]` which are intentional arrays).
