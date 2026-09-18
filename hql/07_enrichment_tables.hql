-- ============================================================================
-- ENRICHMENT TABLES — 5 External Datasets for Data Enrichment
-- Run: hive -f 07_enrichment_tables.hql
-- ============================================================================

USE ticketmeta09;

-- ═══════════════════════════════════════════════════════════
-- 1. ACSI Customer Satisfaction Scores
-- Source: American Customer Satisfaction Index (theacsi.org)
-- ═══════════════════════════════════════════════════════════

CREATE EXTERNAL TABLE IF NOT EXISTS ext_acsi_scores (
    airline_name    STRING,
    acsi_score      INT,
    year            INT
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/acsi_scores'
TBLPROPERTIES ('skip.header.line.count'='1');

CREATE TABLE IF NOT EXISTS acsi_scores_orc (
    airline_name    STRING,
    acsi_score      INT,
    year            INT
)
STORED AS ORC TBLPROPERTIES ('orc.compress'='SNAPPY');

INSERT OVERWRITE TABLE acsi_scores_orc
SELECT * FROM ext_acsi_scores;

SELECT * FROM acsi_scores_orc;


-- ═══════════════════════════════════════════════════════════
-- 2. FAA Airline Delay Causes
-- Source: Bureau of Transportation Statistics (BTS)
-- ═══════════════════════════════════════════════════════════

DROP TABLE IF EXISTS ext_airline_delay_cause;

CREATE EXTERNAL TABLE ext_airline_delay_cause (
    year INT, month INT, carrier STRING, carrier_name STRING,
    airport STRING, airport_name STRING,
    arr_flights DOUBLE, arr_del15 DOUBLE,
    carrier_ct DOUBLE, weather_ct DOUBLE, nas_ct DOUBLE,
    security_ct DOUBLE, late_aircraft_ct DOUBLE,
    arr_cancelled DOUBLE, arr_diverted DOUBLE, arr_delay DOUBLE,
    carrier_delay DOUBLE, weather_delay DOUBLE, nas_delay DOUBLE,
    security_delay DOUBLE, late_aircraft_delay DOUBLE
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/airline_delay_cause'
TBLPROPERTIES ('skip.header.line.count'='1');

DROP TABLE IF EXISTS airline_delay_cause_orc;
CREATE TABLE airline_delay_cause_orc
STORED AS ORC TBLPROPERTIES ('orc.compress'='SNAPPY')
AS SELECT * FROM ext_airline_delay_cause;

-- Verify delay data
SELECT carrier_name,
       ROUND(SUM(arr_del15), 0) AS delays,
       ROUND(SUM(arr_flights), 0) AS flights,
       ROUND((1 - SUM(arr_del15)/SUM(arr_flights)) * 100, 1) AS ontime_pct
FROM airline_delay_cause_orc
WHERE carrier_name IS NOT NULL
GROUP BY carrier_name
ORDER BY flights DESC LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- 3. DOT Complaint Rates
-- Source: US Dept. of Transportation Air Travel Consumer Report
-- ═══════════════════════════════════════════════════════════

CREATE EXTERNAL TABLE IF NOT EXISTS ext_dot_complaints (
    airline_name            STRING,
    complaint_rate_per_100k DOUBLE,
    year                    INT
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/dot_complaints'
TBLPROPERTIES ('skip.header.line.count'='1');

CREATE TABLE IF NOT EXISTS dot_complaints_orc (
    airline_name            STRING,
    complaint_rate_per_100k DOUBLE,
    year                    INT
)
STORED AS ORC TBLPROPERTIES ('orc.compress'='SNAPPY');

INSERT OVERWRITE TABLE dot_complaints_orc
SELECT * FROM ext_dot_complaints;

SELECT * FROM dot_complaints_orc;


-- ═══════════════════════════════════════════════════════════
-- 4. Amtrak NE Corridor Rail Routes
-- Source: Amtrak Official Route Maps + Station API
-- ═══════════════════════════════════════════════════════════

DROP TABLE IF EXISTS amtrak_rail_routes_staging;
CREATE EXTERNAL TABLE amtrak_rail_routes_staging (
    origin_airport        STRING,
    destination_airport   STRING,
    rail_available        STRING,
    rail_service          STRING,
    avg_rail_duration_hrs DOUBLE,
    avg_rail_fare_usd     DOUBLE,
    rail_corridor         STRING
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/amtrak_rail_routes_staging'
TBLPROPERTIES ("skip.header.line.count"="1");

DROP TABLE IF EXISTS amtrak_rail_routes_orc;
CREATE TABLE amtrak_rail_routes_orc (
    origin_airport        STRING,
    destination_airport   STRING,
    rail_available        STRING,
    rail_service          STRING,
    avg_rail_duration_hrs DOUBLE,
    avg_rail_fare_usd     DOUBLE,
    rail_corridor         STRING
)
STORED AS ORC TBLPROPERTIES ("orc.compress"="SNAPPY");

INSERT OVERWRITE TABLE amtrak_rail_routes_orc
SELECT * FROM amtrak_rail_routes_staging;

SELECT rail_available, COUNT(*) AS route_count,
       ROUND(AVG(avg_rail_fare_usd), 2) AS avg_fare
FROM amtrak_rail_routes_orc
GROUP BY rail_available;


-- ═══════════════════════════════════════════════════════════
-- 5. Reddit Airline Sentiment Posts
-- Source: Reddit API — airline complaints, ghost fares, price bait
-- ═══════════════════════════════════════════════════════════

CREATE EXTERNAL TABLE IF NOT EXISTS ext_reddit_posts (
    title           STRING,
    score           INT,
    num_comments    INT,
    url             STRING,
    permalink       STRING,
    created_utc     DOUBLE,
    subreddit       STRING,
    author          STRING,
    selftext        STRING
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY '\t'
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/reddit_posts'
TBLPROPERTIES ('skip.header.line.count'='1');

CREATE TABLE IF NOT EXISTS reddit_posts_orc (
    title           STRING,
    score           INT,
    num_comments    INT,
    url             STRING,
    permalink       STRING,
    created_utc     DOUBLE,
    subreddit       STRING,
    author          STRING,
    selftext        STRING
)
STORED AS ORC TBLPROPERTIES ('orc.compress'='SNAPPY');

INSERT OVERWRITE TABLE reddit_posts_orc
SELECT * FROM ext_reddit_posts;

SELECT COUNT(*) AS total_posts FROM reddit_posts_orc;
SELECT * FROM reddit_posts_orc LIMIT 10;
