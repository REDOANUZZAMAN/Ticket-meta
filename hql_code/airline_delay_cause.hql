
USE ticketmeta09;
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

SELECT 'EXT_TABLE_VERIFY' AS step, COUNT(*) AS cnt FROM ext_airline_delay_cause;

DROP TABLE IF EXISTS airline_delay_cause_orc;
CREATE TABLE airline_delay_cause_orc
STORED AS ORC TBLPROPERTIES ('orc.compress'='SNAPPY')
AS SELECT * FROM ext_airline_delay_cause;

SELECT 'ORC_TABLE_VERIFY' AS step, COUNT(*) AS cnt FROM airline_delay_cause_orc;
SELECT carrier_name, ROUND(SUM(arr_del15),0) AS delays, ROUND(SUM(arr_flights),0) AS flights,
       ROUND((1-SUM(arr_del15)/SUM(arr_flights))*100,1) AS ontime_pct
FROM airline_delay_cause_orc WHERE carrier_name IS NOT NULL
GROUP BY carrier_name ORDER BY flights DESC LIMIT 10;
SHOW TABLES;
