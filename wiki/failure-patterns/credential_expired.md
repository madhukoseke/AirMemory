# Failure Pattern: credential_expired

## Description

Known Airflow failure pattern `credential_expired` captured by AirMemory.

## Symptoms

- credential expired for external connection

## Common Root Causes

- SFTP key rotation reminder was missed.

## Best Known Fixes

- Rotate key, update secret, and rerun from connect_to_bank_sftp.

## Rejected Fixes

- Disabling SFTP validation

## Related Incidents

- inc_2026_02_18_payout_credentials_expired (2026-02-18)

## Prevention

Add credential expiration monitoring and 14-day rotation alert.
