# Security Specification — STD / UMH Wire Harness Studio

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `users`, `masterConfigs`, `assyRecords`, and `refreshHistory` belongs strictly to a single verified Google account (`ownerId == request.auth.uid` or `userId == request.auth.uid`). No blanket reads or cross-user list queries are permitted.
2. **Email Verification Mandate**: All authenticated read/write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Document ID Hardening**: All document IDs (`userId`, `recordId`, `historyId`) must match `^[a-zA-Z0-9_\-]+$` with length `1..128`.
4. **Immutable Audit & Ownership Fields**: `ownerId`, `uid`, `id`, and `createdAt` cannot be modified after creation. `refreshHistory` logs are strictly append-only (`update: if false`).
5. **Server Timestamp Integrity**: `createdAt`, `updatedAt`, and `refreshedAt` must equal `request.time`. Client-forged timestamps are rejected.
6. **Bounded Payloads & Strict Keys**: Every collection enforces `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, and upper bounds on all strings and lists.

## 2. Dirty Dozen Adversarial Payloads
1. **Unauthenticated List Query**: `list /assyRecords` without auth -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `create /users/{uid}` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Cross-User Spoofing**: User A creates `/assyRecords/rec1` with `ownerId: userB` -> `PERMISSION_DENIED`.
4. **Unscoped List Query (Query Trust Bypass)**: User A runs `collection('assyRecords')` without `where('ownerId', '==', uid)` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: `create /assyRecords/rec1` including extra field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: `create /assyRecords/../../admin` or 500-char document ID -> `PERMISSION_DENIED`.
7. **ID Mismatch**: `create /assyRecords/rec1` with payload `id: "rec2"` -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: `update /assyRecords/rec1` changing `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: `create /refreshHistory/h1` with client `Date.now()` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Audit Log Tampering**: `update /refreshHistory/h1` modifying `responsibleName` or `affectedDiffs` -> `PERMISSION_DENIED`.
11. **Oversized String / List DoS**: `create /refreshHistory/h1` with `responsibleName` length 500 or `affectedDiffs` length 600 -> `PERMISSION_DENIED`.
12. **Cross-User Delete**: User A attempts `delete /assyRecords/{userBRecordId}` -> `PERMISSION_DENIED`.
