# DAG: customer_profile_dag

Owner: customer-data-team  
Criticality: medium  
Schedule: 0 4 * * *  

## Business Impact

Delays customer profile mart refresh and personalization features.

## Tasks

- extract_profile
- validate_required_fields
- publish_profile

## Source Tables

- raw.customer_profile

## Target Tables

- mart.customer_profile

## Recent Incidents

- inc_2026_03_28_customer_profile_null_explosion (2026-03-28) - null_value_spike

## Common Failure Patterns

- null_value_spike

## Known Fixes

- Rollback source mapping and rerun profile load.
