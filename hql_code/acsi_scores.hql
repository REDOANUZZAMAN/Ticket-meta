-- ============================================================================
-- ACSI Airline Customer Satisfaction Scores (External Dataset)
-- Source: American Customer Satisfaction Index (theacsi.org) - 2022 Report
-- ============================================================================
-- Step 1: Upload CSV to HDFS
-- hdfs dfs -mkdir -p /user/hive/warehouse/external_data
-- hdfs dfs -put acsi_airline_scores.csv /user/hive/warehouse/external_data/

USE ticketmeta09;

-- Step 2: Create external table pointing to CSV on HDFS
CREATE EXTERNAL TABLE IF NOT EXISTS ext_acsi_scores (
    airline_name    STRING,
    acsi_score      INT,
    year            INT
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/acsi_scores'
TBLPROPERTIES ('skip.header.line.count'='1');

-- Step 3: Create optimized ORC table for faster joins
CREATE TABLE IF NOT EXISTS acsi_scores_orc (
    airline_name    STRING,
    acsi_score      INT,
    year            INT
)
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- Step 4: Load data from external table into ORC
INSERT OVERWRITE TABLE acsi_scores_orc
SELECT * FROM ext_acsi_scores;

-- Step 5: Verify data
SELECT * FROM acsi_scores_orc;

-- ============================================================================
-- Example JOIN with internal itineraries data:
-- This is how we cross-reference internal flight pricing with external
-- customer satisfaction data to measure brand markup.
-- ============================================================================
-- SELECT 
--     i.segmentsAirlineName AS airline,
--     ROUND(AVG(CAST(i.totalFare AS DOUBLE)), 2) AS avgFare,
--     a.acsi_score,
--     COUNT(*) AS flightCount
-- FROM itineraries_orc i
-- LEFT JOIN acsi_scores_orc a 
--     ON LOWER(i.segmentsAirlineName) LIKE CONCAT('%', LOWER(SPLIT(a.airline_name, ' ')[0]), '%')
-- WHERE i.isNonStop = 'True'
--   AND i.startingAirport = 'ATL' AND i.destinationAirport = 'LAX'
-- GROUP BY i.segmentsAirlineName, a.acsi_score
-- ORDER BY avgFare DESC;
