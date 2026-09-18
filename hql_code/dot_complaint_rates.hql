-- ============================================================================
-- DOT Airline Complaint Rates (External Dataset)
-- Source: US Dept. of Transportation - Air Travel Consumer Report (2022)
-- URL: https://www.transportation.gov/airconsumer/air-travel-consumer-reports
-- ============================================================================
-- Step 1: Upload CSV to HDFS
-- hdfs dfs -mkdir -p /user/hive/warehouse/external_data
-- hdfs dfs -put dot_complaint_rates.csv /user/hive/warehouse/external_data/

USE ticketmeta09;

-- Step 2: Create external table pointing to CSV on HDFS
CREATE EXTERNAL TABLE IF NOT EXISTS ext_dot_complaints (
    airline_name            STRING,
    complaint_rate_per_100k DOUBLE,
    year                    INT
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/dot_complaints'
TBLPROPERTIES ('skip.header.line.count'='1');

-- Step 3: Create optimized ORC table for faster joins
CREATE TABLE IF NOT EXISTS dot_complaints_orc (
    airline_name            STRING,
    complaint_rate_per_100k DOUBLE,
    year                    INT
)
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- Step 4: Load data from external table into ORC
INSERT OVERWRITE TABLE dot_complaints_orc
SELECT * FROM ext_dot_complaints;

-- Step 5: Verify data
SELECT * FROM dot_complaints_orc;

-- ============================================================================
-- Example JOIN: Brand Markup Analysis
-- Combines internal pricing (itineraries_orc) with external quality metrics
-- (ACSI scores, DOT complaints, BTS on-time data) for the same airlines.
-- ============================================================================
-- SELECT 
--     i.segmentsAirlineName AS airline,
--     ROUND(AVG(CAST(i.totalFare AS DOUBLE)), 2) AS avgFare,
--     a.acsi_score,
--     d.complaint_rate_per_100k,
--     ROUND((1 - SUM(del.arr_del15)/SUM(del.arr_flights))*100, 1) AS onTimePct
-- FROM itineraries_orc i
-- LEFT JOIN acsi_scores_orc a 
--     ON LOWER(i.segmentsAirlineName) LIKE CONCAT('%', LOWER(SPLIT(a.airline_name, ' ')[0]), '%')
-- LEFT JOIN dot_complaints_orc d
--     ON LOWER(i.segmentsAirlineName) LIKE CONCAT('%', LOWER(SPLIT(d.airline_name, ' ')[0]), '%')
-- LEFT JOIN airline_delay_cause_orc del
--     ON LOWER(del.carrier_name) LIKE CONCAT('%', LOWER(SPLIT(i.segmentsAirlineName, ' ')[0]), '%')
-- WHERE i.isNonStop = 'True'
--   AND i.startingAirport = 'ATL' AND i.destinationAirport = 'LAX'
-- GROUP BY i.segmentsAirlineName, a.acsi_score, d.complaint_rate_per_100k
-- ORDER BY avgFare DESC;
