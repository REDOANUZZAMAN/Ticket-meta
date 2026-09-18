-- ============================================================================
-- DATA ENRICHMENT QUERIES — Cross-referencing internal + external datasets
-- Used by: /api/enrichment/* endpoints in flask_api.py
-- ============================================================================

USE ticketmeta09;

-- ═══════════════════════════════════════════════════════════
-- 1. WEATHER ENRICHMENT (/api/enrichment/weather)
-- Seasonal pricing patterns by flight month
-- ═══════════════════════════════════════════════════════════

SELECT flightDate,
       MONTH(TO_DATE(flightDate)) AS flightMonth,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'LAX'
  AND CAST(totalFare AS DOUBLE) > 0
GROUP BY flightDate, MONTH(TO_DATE(flightDate))
ORDER BY flightDate;


-- ═══════════════════════════════════════════════════════════
-- 2. WEALTH/INCOME ENRICHMENT (/api/enrichment/wealth)
-- Municipality-level median income cross-ref with fare data
-- ═══════════════════════════════════════════════════════════

SELECT startingAirport,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport
ORDER BY flightCount DESC
LIMIT 30;


-- ═══════════════════════════════════════════════════════════
-- 3. BRAND MARKUP ENRICHMENT (/api/enrichment/brand)
-- Cross-ref: ACSI satisfaction scores + DOT complaints + BTS delays
-- ═══════════════════════════════════════════════════════════

-- 3a. ACSI Scores query
SELECT airline_name, acsi_score
FROM acsi_scores_orc
WHERE year = 2022;

-- 3b. DOT Complaint Rates query
SELECT airline_name, complaint_rate_per_100k
FROM dot_complaints_orc
WHERE year = 2022;

-- 3c. Top competitive nonstop routes
SELECT startingAirport, destinationAirport,
       COUNT(DISTINCT segmentsAirlineName) AS airlines,
       COUNT(*) AS flights
FROM itineraries_orc
WHERE isNonStop = 'True'
  AND CAST(totalFare AS DOUBLE) > 0
  AND segmentsAirlineName IS NOT NULL
  AND TRIM(segmentsAirlineName) != ''
GROUP BY startingAirport, destinationAirport
HAVING COUNT(DISTINCT segmentsAirlineName) >= 3
ORDER BY flights DESC
LIMIT 5;

-- 3d. Per-airline pricing on a specific route
SELECT segmentsAirlineName AS airline,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'LAX'
  AND isNonStop = 'True'
  AND CAST(totalFare AS DOUBLE) > 0
  AND segmentsAirlineName IS NOT NULL
GROUP BY segmentsAirlineName
ORDER BY avgFare DESC;

-- 3e. BTS Delay data (on-time performance)
SELECT carrier_name,
       ROUND(SUM(arr_del15), 0) AS total_delays,
       ROUND(SUM(arr_flights), 0) AS total_flights,
       ROUND((1 - SUM(arr_del15)/SUM(arr_flights)) * 100, 1) AS ontime_pct
FROM airline_delay_cause_orc
WHERE carrier_name IS NOT NULL
GROUP BY carrier_name
ORDER BY total_flights DESC;


-- ═══════════════════════════════════════════════════════════
-- 4. RAIL COMPETITION ENRICHMENT (/api/enrichment/rail)
-- Amtrak NE Corridor vs flight pricing
-- ═══════════════════════════════════════════════════════════

-- 4a. Rail routes with availability
SELECT origin_airport, destination_airport, rail_available,
       rail_service, avg_rail_fare_usd, rail_corridor
FROM amtrak_rail_routes_orc
WHERE rail_available = 'Yes';

-- 4b. Short-haul flights under 400 miles (teacher requirement)
SELECT startingAirport, destinationAirport,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFlightFare,
       ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)), 0) AS avgDistance,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalTravelDistance AS DOUBLE) BETWEEN 50 AND 400
  AND CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport, destinationAirport
HAVING COUNT(*) >= 10
ORDER BY flightCount DESC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════
-- 5. GHOST FARE DETECTION (/api/enrichment/ghost)
-- Price anomalies, volatility, and sawtooth patterns
-- ═══════════════════════════════════════════════════════════

-- 5a. Price Anomaly Detection (max/min ratio > 3x)
SELECT startingAirport, destinationAirport, flightDate,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)) / MIN(CAST(totalFare AS DOUBLE)), 1) AS ratio,
       COUNT(*) AS observations
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport, destinationAirport, flightDate
HAVING MAX(CAST(totalFare AS DOUBLE)) / MIN(CAST(totalFare AS DOUBLE)) > 3
   AND COUNT(*) >= 5
ORDER BY ratio DESC
LIMIT 20;

-- 5b. Price Volatility (stddev of fares per route/flight)
SELECT startingAirport, destinationAirport, flightDate,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(STDDEV(CAST(totalFare AS DOUBLE)), 2) AS stdFare,
       ROUND(STDDEV(CAST(totalFare AS DOUBLE)) / AVG(CAST(totalFare AS DOUBLE)) * 100, 1) AS volatilityPct,
       COUNT(*) AS pricePoints
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport, destinationAirport, flightDate
HAVING COUNT(*) >= 10
ORDER BY volatilityPct DESC
LIMIT 20;

-- 5c. Sawtooth routes (high volatility busiest routes)
SELECT startingAirport, destinationAirport,
       COUNT(DISTINCT flightDate) AS uniqueFlightDates,
       COUNT(*) AS totalObs
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport, destinationAirport
HAVING COUNT(DISTINCT flightDate) >= 10
ORDER BY totalObs DESC
LIMIT 5;

-- 5d. Time-series for sawtooth analysis (per search date)
SELECT searchDate,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS obs
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'LAX'
  AND flightDate = '2022-04-17'
  AND CAST(totalFare AS DOUBLE) > 0
GROUP BY searchDate
ORDER BY searchDate;

-- 5e. Reddit sentiment data
SELECT title, score, num_comments, url, permalink,
       created_utc, subreddit, author
FROM reddit_posts_orc
ORDER BY score DESC;


-- ═══════════════════════════════════════════════════════════
-- 6. ALS RECOMMENDATION QUERY (/api/recommend)
-- Collaborative filtering - user-route fare matrix
-- ═══════════════════════════════════════════════════════════

SELECT destinationAirport,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       COUNT(*) AS flights,
       ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)), 0) AS avgDist
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND CAST(totalFare AS DOUBLE) > 0
GROUP BY destinationAirport
ORDER BY flights DESC
LIMIT 10;
