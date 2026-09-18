-- ============================================================
-- Amtrak NE Corridor Rail Routes — External Dataset
-- Source: Amtrak Official Route Maps + Station API
-- Purpose: Identify airport pairs with rail alternative for
--          Intermodal Competition (Rail Price Ceiling) analysis
-- ============================================================

USE ticketmeta09;

-- Step 1: Create staging table (CSV)
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
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/amtrak_rail_routes_staging'
TBLPROPERTIES ("skip.header.line.count"="1");

-- Step 2: Create optimized ORC table
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
STORED AS ORC
TBLPROPERTIES ("orc.compress"="SNAPPY");

-- Step 3: Load data from staging → ORC
INSERT OVERWRITE TABLE amtrak_rail_routes_orc
SELECT * FROM amtrak_rail_routes_staging;

-- Step 4: Verify
SELECT rail_available, COUNT(*) AS route_count,
       ROUND(AVG(avg_rail_fare_usd), 2) AS avg_fare
FROM amtrak_rail_routes_orc
GROUP BY rail_available;
