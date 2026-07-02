WITH source_records AS (
  SELECT customer_id, updated_at, processing_date
  FROM hana.customer_master
  WHERE processing_date BETWEEN DATE_SUB(@system_date, INTERVAL 3 DAY)
    AND DATE_ADD(@system_date, INTERVAL 3 DAY)
),
target_records AS (
  SELECT customer_id, updated_at, processing_date
  FROM bq.prod.customer_master
  WHERE processing_date BETWEEN DATE_SUB(@system_date, INTERVAL 3 DAY)
    AND DATE_ADD(@system_date, INTERVAL 3 DAY)
),
source_unmatched AS (
  SELECT source_records.*
  FROM source_records
  LEFT JOIN target_records USING (customer_id)
  WHERE target_records.customer_id IS NULL
)
SELECT
  (SELECT COUNT(*) FROM source_records) AS source_count,
  (SELECT COUNT(*) FROM target_records) AS target_count,
  (SELECT COUNT(*) FROM source_unmatched) AS unmatched_source_count;

