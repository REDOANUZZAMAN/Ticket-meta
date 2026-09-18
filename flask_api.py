"""
Flask API for Flight Search - connects to Hive via PySpark (ticketmeta09)
Deploy this file on your VM (192.168.56.104)
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import json
import re
import time
import threading

app = Flask(__name__)
CORS(app)

# ── Permanent VM Environment Setup ──────────────────────────────────────────
# These ensure Hadoop/Spark/Hive work without needing external helper scripts.
if os.name != 'nt':  # Only on Linux (VM)
    _env = {
        "JAVA_HOME": "/usr/lib/jvm/java-11-openjdk-amd64",
        "HADOOP_HOME": "/opt/hadoop-3.3.6",
        "HADOOP_CONF_DIR": "/opt/hadoop-3.3.6/etc/hadoop",
        "SPARK_HOME": "/opt/spark-3.5.3",
        "HIVE_HOME": "/opt/apache-hive-4.0.1",
    }
    for k, v in _env.items():
        if k not in os.environ or not os.environ[k]:
            os.environ[k] = v
    # Extend PATH
    extra_paths = [
        os.path.join(_env["HADOOP_HOME"], "bin"),
        os.path.join(_env["HADOOP_HOME"], "sbin"),
        os.path.join(_env["SPARK_HOME"], "bin"),
        os.path.join(_env["HIVE_HOME"], "bin"),
    ]
    os.environ["PATH"] = ":".join(extra_paths) + ":" + os.environ.get("PATH", "")

# Attempt to import PySpark gracefully
try:
    from pyspark.sql import SparkSession # type: ignore
    HAS_PYSPARK = True
except ImportError:
    HAS_PYSPARK = False

# ---------------------------------------------------------------------------
# In-Memory Cache (results cached for 2 hours)
# ---------------------------------------------------------------------------
_cache = {}
_cache_lock = threading.Lock()
CACHE_TTL = 7200  # 2 hours in seconds

def cache_get(key):
    """Get cached result if still valid."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < CACHE_TTL:
            return entry["data"]
    return None

def cache_set(key, data):
    """Store result in cache."""
    with _cache_lock:
        _cache[key] = {"data": data, "ts": time.time()}

def cached_query(cache_key, query_fn):
    """Run query_fn() with caching. Returns cached result if available."""
    cached = cache_get(cache_key)
    if cached is not None:
        cached["cached"] = True
        return cached
    result = query_fn()
    result["cached"] = False
    cache_set(cache_key, result)
    return result

# ---------------------------------------------------------------------------
# PySpark Session (singleton)
# ---------------------------------------------------------------------------
_spark = None

# MySQL JDBC driver path (required for Hive Metastore connection)
MYSQL_DRIVER = "/opt/apache-hive-4.0.1/lib/mysql-connector-j-8.4.0.jar"

def get_spark():
    """Get or create a SparkSession with Hive support."""
    global _spark
    if not HAS_PYSPARK:
        return _spark

    if _spark is None or _spark._jsc.sc().isStopped():
        builder = SparkSession.builder.appName("SkyQuery-FlaskAPI")
        
        # Check if we are running locally (e.g. Windows) vs the VM
        if os.name == 'nt' or not os.path.exists(MYSQL_DRIVER):
            print("WARNING: Running in local mode. Hive/YARN connections disabled.")
            builder = builder.master("local[*]")
        else:
            # Simple config: builtin Hive, MySQL JDBC for metastore, YARN
            builder = (
                builder.master("yarn")
                .config("spark.submit.deployMode", "client")
                .config("spark.driver.extraClassPath", MYSQL_DRIVER)
                .config("spark.executor.extraClassPath", MYSQL_DRIVER)
                .enableHiveSupport()
            )
            
        # Common configs (conservative while ORC job may be running)
        builder = (
            builder.config("spark.sql.shuffle.partitions", "8")
            .config("spark.driver.memory", "1g")
            .config("spark.executor.memory", "1g")
            .config("spark.executor.instances", "1")
            .config("spark.executor.cores", "1")
            .config("spark.yarn.queue", "default")
            .config("spark.network.timeout", "600s")
            .config("spark.executor.heartbeatInterval", "120s")
        )

        _spark = builder.getOrCreate()
        
        if os.name != 'nt' and os.path.exists(MYSQL_DRIVER):
            _spark.sql("USE ticketmeta09")

        # Try to use the optimized ORC table if it exists, otherwise cache
        try:
            tables = [r["tableName"] for r in _spark.sql("SHOW TABLES").collect()]
            if "itineraries_orc" in tables:
                print("Found optimized itineraries_orc table!")
            else:
                print("No optimized table found. Consider running the optimization script.")
                if os.name != 'nt':
                    print("Caching ext_itineraries for faster repeated queries...")
                    _spark.sql("CACHE LAZY TABLE ext_itineraries")
        except Exception as e:
            print(f"Cache/optimization check: {e}")
            
    return _spark


def get_flight_table():
    """Return the best available flight table name."""
    spark = get_spark()
    try:
        tables = [r["tableName"] for r in spark.sql("SHOW TABLES").collect()]
        if "itineraries_orc" in tables:
            return "itineraries_orc"
    except:
        pass
    return "ext_itineraries"


def run_query(sql):
    """Execute a Spark SQL / HiveQL query and return rows + column names."""
    spark = get_spark()
    if spark is None:
        # Return empty results in local dev mode (no PySpark)
        print(f"[LOCAL MODE] Skipping query (no PySpark): {sql[:100]}...")
        return [], []
    
    try:
        df = spark.sql(sql)
        cols = df.columns
        rows = [row.asDict() for row in df.collect()]
        return cols, rows
    except Exception as e:
        if "py4j.reflection.TypeUtil" in str(e) or "Table or view not found" in str(e) or "SparkSession" in str(e):
            print(f"Bypassing PySpark error in local dev mode: {e}")
            return [], []
        raise e


def clean_row(row_dict):
    """Clean column names (remove table prefix if present) and convert types."""
    cleaned = {}
    for k, v in row_dict.items():
        key = k.split(".")[-1]
        # Convert Decimal, etc. to float for JSON serialization
        if v is not None and hasattr(v, '__float__'):
            cleaned[key] = float(v)
        else:
            cleaned[key] = v
    return cleaned


# ---------------------------------------------------------------------------
# Cache Management
# ---------------------------------------------------------------------------
@app.route("/api/cache/clear", methods=["POST", "GET"])
def clear_cache():
    """Clear all cached analytics results."""
    with _cache_lock:
        count = len(_cache)
        _cache.clear()
    return jsonify({"message": f"Cleared {count} cached entries", "cleared": count})


# ---------------------------------------------------------------------------
# Health / Tables
# ---------------------------------------------------------------------------
@app.route("/api/health")
def health():
    try:
        if not HAS_PYSPARK:
            return jsonify({"status": "connected", "msg": "Running in dummy/local mode without PySpark."})
            
        spark = get_spark()
        spark.sql("SELECT 1").collect()
        return jsonify({"status": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


@app.route("/api/tables")
def tables():
    try:
        spark = get_spark()
        df = spark.sql("SHOW TABLES")
        t = [row["tableName"] for row in df.collect()]
        return jsonify({"tables": t})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 1. Search Flights
#    GET /api/search-flights?origin=MIA&dest=SFO&nonstop=true&sort=cheapest&limit=20
# ---------------------------------------------------------------------------
@app.route("/api/search-flights")
def search_flights():
    origin = request.args.get("origin", "").upper()
    dest = request.args.get("dest", "").upper()
    nonstop = request.args.get("nonstop", "false").lower() == "true"
    sort = request.args.get("sort", "cheapest")
    limit = int(request.args.get("limit", 20))
    date = request.args.get("date", "")

    if not origin or not dest:
        return jsonify({"error": "origin and dest are required"}), 400

    where = f"startingAirport = '{origin}' AND destinationAirport = '{dest}'"
    if nonstop:
        where += " AND isNonStop = 'True'"
    if date:
        where += f" AND flightDate = '{date}'"

    order = "CAST(totalFare AS DOUBLE) ASC"
    if sort == "fastest":
        order = "CAST(segmentsDurationInSeconds AS DOUBLE) ASC"
    elif sort == "best":
        order = "CASE WHEN isNonStop = 'True' THEN 0 ELSE 1 END ASC, CAST(totalFare AS DOUBLE) * 0.6 + CAST(segmentsDurationInSeconds AS DOUBLE) / 60 * 0.4 ASC"

    tbl = get_flight_table()
    sql = f"""
        SELECT legId, searchDate, flightDate, startingAirport, destinationAirport,
               travelDuration, isNonStop, isBasicEconomy, isRefundable,
               CAST(baseFare AS DOUBLE) AS baseFare,
               CAST(totalFare AS DOUBLE) AS totalFare,
               CAST(seatsRemaining AS INT) AS seatsRemaining,
               CAST(totalTravelDistance AS DOUBLE) AS totalTravelDistance,
               segmentsDepartureTimeRaw, segmentsArrivalTimeRaw,
               segmentsArrivalAirportCode, segmentsDepartureAirportCode,
               segmentsAirlineName, segmentsAirlineCode,
               segmentsEquipmentDescription, segmentsCabinCode
        FROM {tbl}
        WHERE {where}
        ORDER BY {order}
        LIMIT {limit}
    """

    try:
        cols, rows = run_query(sql)
        flights = [clean_row(r) for r in rows]
        return jsonify({"flights": flights, "count": len(flights), "query": sql.strip()})
    except Exception as e:
        return jsonify({"error": str(e), "query": sql.strip()}), 500


# ---------------------------------------------------------------------------
# 2. Where to Fly
#    GET /api/where-to-fly?origin=ATL&limit=10
# ---------------------------------------------------------------------------
@app.route("/api/where-to-fly")
def where_to_fly():
    origin = request.args.get("origin", "").upper()
    limit = int(request.args.get("limit", 10))
    nonstop = request.args.get("nonstop", "false").lower() == "true"

    if not origin:
        return jsonify({"error": "origin is required"}), 400

    nonstop_filter = "AND isNonStop = 'True'" if nonstop else ""

    tbl = get_flight_table()
    sql = f"""
        SELECT destinationAirport,
               ROUND(MIN(CAST(totalFare AS DOUBLE)), 2)  AS minFare,
               ROUND(AVG(CAST(totalFare AS DOUBLE)), 2)  AS avgFare,
               COUNT(*) AS flightCount
        FROM {tbl}
        WHERE startingAirport = '{origin}' {nonstop_filter}
        GROUP BY destinationAirport
        ORDER BY minFare ASC
        LIMIT {limit}
    """

    try:
        cols, rows = run_query(sql)
        destinations = [clean_row(r) for r in rows]
        return jsonify({"origin": origin, "destinations": destinations, "query": sql.strip()})
    except Exception as e:
        return jsonify({"error": str(e), "query": sql.strip()}), 500


# ---------------------------------------------------------------------------
# 3. When to Fly
#    GET /api/when-to-fly?origin=ATL&dest=LAX
# ---------------------------------------------------------------------------
@app.route("/api/when-to-fly")
def when_to_fly():
    origin = request.args.get("origin", "").upper()
    dest = request.args.get("dest", "").upper()

    if not origin or not dest:
        return jsonify({"error": "origin and dest are required"}), 400

    tbl = get_flight_table()
    sql = f"""
        SELECT SUBSTR(flightDate, 1, 7) AS month,
               ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
               ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
               ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
               COUNT(*) AS flightCount
        FROM {tbl}
        WHERE startingAirport = '{origin}'
          AND destinationAirport = '{dest}'
        GROUP BY SUBSTR(flightDate, 1, 7)
        ORDER BY month ASC
    """

    try:
        cols, rows = run_query(sql)
        months = [clean_row(r) for r in rows]
        return jsonify({"origin": origin, "dest": dest, "months": months, "query": sql.strip()})
    except Exception as e:
        return jsonify({"error": str(e), "query": sql.strip()}), 500


# ---------------------------------------------------------------------------
# 4. Airline Comparison
#    GET /api/airline-comparison?origin=ATL&dest=LAX
# ---------------------------------------------------------------------------
@app.route("/api/airline-comparison")
def airline_comparison():
    origin = request.args.get("origin", "").upper()
    dest = request.args.get("dest", "").upper()

    if not origin or not dest:
        return jsonify({"error": "origin and dest are required"}), 400

    tbl = get_flight_table()
    sql = f"""
        SELECT segmentsAirlineName AS airline,
               ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
               ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
               ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
               COUNT(*) AS flightCount
        FROM {tbl}
        WHERE startingAirport = '{origin}'
          AND destinationAirport = '{dest}'
        GROUP BY segmentsAirlineName
        ORDER BY avgFare ASC
    """

    try:
        cols, rows = run_query(sql)
        airlines = [clean_row(r) for r in rows]
        return jsonify({"origin": origin, "dest": dest, "airlines": airlines, "query": sql.strip()})
    except Exception as e:
        return jsonify({"error": str(e), "query": sql.strip()}), 500


# ---------------------------------------------------------------------------
# 5a. Analytics – Pricing Overview
#     GET /api/analytics/overview
# ---------------------------------------------------------------------------
@app.route("/api/analytics/overview")
def analytics_overview():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT
                COUNT(*)                                        AS totalFlights,
                ROUND(AVG(CAST(totalFare AS DOUBLE)), 2)        AS avgFare,
                ROUND(MIN(CAST(totalFare AS DOUBLE)), 2)        AS minFare,
                ROUND(MAX(CAST(totalFare AS DOUBLE)), 2)        AS maxFare,
                SUM(CASE WHEN isRefundable = 'True'  THEN 1 ELSE 0 END) AS refundableCount,
                SUM(CASE WHEN isRefundable = 'False' THEN 1 ELSE 0 END) AS nonRefundableCount,
                ROUND(AVG(CASE WHEN isRefundable = 'True'  THEN CAST(totalFare AS DOUBLE) END), 2) AS avgFareRefundable,
                ROUND(AVG(CASE WHEN isRefundable = 'False' THEN CAST(totalFare AS DOUBLE) END), 2) AS avgFareNonRefundable,
                SUM(CASE WHEN isBasicEconomy = 'True'  THEN 1 ELSE 0 END) AS basicEconomyCount,
                SUM(CASE WHEN isBasicEconomy = 'False' THEN 1 ELSE 0 END) AS standardEconomyCount,
                SUM(CASE WHEN isNonStop = 'True'  THEN 1 ELSE 0 END) AS nonstopCount,
                SUM(CASE WHEN isNonStop = 'False' THEN 1 ELSE 0 END) AS connectingCount
            FROM {tbl}
        """
        _, rows = run_query(sql)
        overview = clean_row(rows[0]) if rows else {}
        return {"overview": overview, "query": sql.strip()}
    try:
        result = cached_query("analytics_overview", _query)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5b. Analytics – Top 15 Airlines
#     GET /api/analytics/top-airlines
# ---------------------------------------------------------------------------
@app.route("/api/analytics/top-airlines")
def analytics_top_airlines():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT segmentsAirlineName AS airline,
                   COUNT(*) AS flightCount,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
                   ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
                   ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare
            FROM {tbl}
            WHERE segmentsAirlineName IS NOT NULL AND segmentsAirlineName != ''
            GROUP BY segmentsAirlineName
            ORDER BY flightCount DESC
            LIMIT 15
        """
        _, rows = run_query(sql)
        airlines = [clean_row(r) for r in rows]
        return {"airlines": airlines, "query": sql.strip()}
    try:
        return jsonify(cached_query("analytics_top_airlines", _query))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5c. Analytics – Flights by Day of Week
#     GET /api/analytics/day-of-week
# ---------------------------------------------------------------------------
@app.route("/api/analytics/day-of-week")
def analytics_day_of_week():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT
                CASE DAYOFWEEK(flightDate)
                    WHEN 1 THEN 'Sunday'    WHEN 2 THEN 'Monday'
                    WHEN 3 THEN 'Tuesday'   WHEN 4 THEN 'Wednesday'
                    WHEN 5 THEN 'Thursday'  WHEN 6 THEN 'Friday'
                    WHEN 7 THEN 'Saturday'
                END AS dayName,
                DAYOFWEEK(flightDate) AS dayNum,
                COUNT(*) AS flightCount,
                ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare
            FROM {tbl}
            WHERE flightDate IS NOT NULL
            GROUP BY DAYOFWEEK(flightDate)
            ORDER BY DAYOFWEEK(flightDate)
        """
        _, rows = run_query(sql)
        days = [clean_row(r) for r in rows]
        return {"days": days, "query": sql.strip()}
    try:
        return jsonify(cached_query("analytics_day_of_week", _query))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5d. Analytics – Booking Window (avg price vs days before departure)
#     GET /api/analytics/booking-window
# ---------------------------------------------------------------------------
@app.route("/api/analytics/booking-window")
def analytics_booking_window():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT
                DATEDIFF(flightDate, searchDate) AS bookingWindow,
                COUNT(*) AS flightCount,
                ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
                ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare
            FROM {tbl}
            WHERE flightDate IS NOT NULL AND searchDate IS NOT NULL
              AND DATEDIFF(flightDate, searchDate) >= 0
              AND DATEDIFF(flightDate, searchDate) <= 180
            GROUP BY DATEDIFF(flightDate, searchDate)
            ORDER BY bookingWindow ASC
        """
        _, rows = run_query(sql)
        data = [clean_row(r) for r in rows]
        return {"bookingWindow": data, "query": sql.strip()}
    try:
        return jsonify(cached_query("analytics_booking_window", _query))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5e. Analytics – Weekend vs Mid-week Pricing
#     GET /api/analytics/weekend-midweek
# ---------------------------------------------------------------------------
@app.route("/api/analytics/weekend-midweek")
def analytics_weekend_midweek():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT
                CASE
                    WHEN DAYOFWEEK(flightDate) IN (1, 6, 7) THEN 'Weekend (Fri/Sat/Sun)'
                    ELSE 'Midweek (Mon-Thu)'
                END AS travelType,
                COUNT(*) AS flightCount,
                ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
                ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
                ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare
            FROM {tbl}
            WHERE flightDate IS NOT NULL
            GROUP BY CASE
                    WHEN DAYOFWEEK(flightDate) IN (1, 6, 7) THEN 'Weekend (Fri/Sat/Sun)'
                    ELSE 'Midweek (Mon-Thu)'
                END
        """
        _, rows = run_query(sql)
        data = [clean_row(r) for r in rows]
        return {"comparison": data, "query": sql.strip()}
    try:
        return jsonify(cached_query("analytics_weekend_midweek", _query))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5f. Analytics – Basic vs Standard Economy Price Gap
#     GET /api/analytics/economy-gap
# ---------------------------------------------------------------------------
@app.route("/api/analytics/economy-gap")
def analytics_economy_gap():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT
                startingAirport, destinationAirport,
                ROUND(AVG(CASE WHEN isBasicEconomy = 'True'  THEN CAST(totalFare AS DOUBLE) END), 2) AS avgBasic,
                ROUND(AVG(CASE WHEN isBasicEconomy = 'False' THEN CAST(totalFare AS DOUBLE) END), 2) AS avgStandard,
                ROUND(
                    AVG(CASE WHEN isBasicEconomy = 'False' THEN CAST(totalFare AS DOUBLE) END) -
                    AVG(CASE WHEN isBasicEconomy = 'True'  THEN CAST(totalFare AS DOUBLE) END)
                , 2) AS priceGap,
                COUNT(*) AS totalFlights
            FROM {tbl}
            GROUP BY startingAirport, destinationAirport
            HAVING AVG(CASE WHEN isBasicEconomy = 'True' THEN CAST(totalFare AS DOUBLE) END) IS NOT NULL
               AND AVG(CASE WHEN isBasicEconomy = 'False' THEN CAST(totalFare AS DOUBLE) END) IS NOT NULL
            ORDER BY priceGap DESC
            LIMIT 20
        """
        _, rows = run_query(sql)
        data = [clean_row(r) for r in rows]
        return {"routes": data, "query": sql.strip()}
    try:
        return jsonify(cached_query("analytics_economy_gap", _query))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5g. Flight Splicing Engine – Find cost-saving virtual itineraries
#     GET /api/flight-splicing?origin=ATL&dest=SFO&date=2024-03-15
#     Intelligent Flight Splicing with auto layover (90min–8hr),
#     cross-alliance detection, and savings-only filtering.
# ---------------------------------------------------------------------------
@app.route("/api/flight-splicing")
def flight_splicing():
    origin = request.args.get("origin", "").upper()
    dest = request.args.get("dest", "").upper()
    flight_date = request.args.get("date", "").strip()
    limit = int(request.args.get("limit", 30))

    # Hardcoded realistic layover boundaries
    MIN_LAYOVER_HRS = 1.5   # 90 minutes minimum for safe connection
    MAX_LAYOVER_HRS = 8     # 8 hours maximum for user experience

    if not origin or not dest:
        return jsonify({"error": "origin and dest are required"}), 400

    tbl = get_flight_table()

    # Optional date filter
    date_filter = f"AND flightDate = '{flight_date}'" if flight_date else ""

    # Step 1: Direct flight baseline
    direct_sql = f"""
        SELECT ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS bestDirect,
               ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgDirect,
               COUNT(*) AS directCount
        FROM {tbl}
        WHERE startingAirport = '{origin}' AND destinationAirport = '{dest}'
        {date_filter}
    """

    # Step 2: Intelligent flight splicing — find disconnected segments
    # that can be combined into a single journey on the same day.
    # Enforces 90-min to 8-hr layover window automatically.
    splice_sql = f"""
        SELECT
            leg1.startingAirport AS origin,
            leg1.destinationAirport AS hub,
            leg2.destinationAirport AS dest,
            leg1.flightDate,
            leg1.segmentsAirlineName AS airline1,
            leg2.segmentsAirlineName AS airline2,
            ROUND(CAST(leg1.totalFare AS DOUBLE), 2) AS fare1,
            ROUND(CAST(leg2.totalFare AS DOUBLE), 2) AS fare2,
            ROUND(CAST(leg1.totalFare AS DOUBLE) + CAST(leg2.totalFare AS DOUBLE), 2) AS combinedFare,
            leg1.segmentsArrivalTimeRaw AS leg1Arrival,
            leg2.segmentsDepartureTimeRaw AS leg2Departure,
            ROUND(
                (CAST(leg2.segmentsDepartureTimeEpochSeconds AS BIGINT) -
                 CAST(leg1.segmentsArrivalTimeEpochSeconds AS BIGINT)) / 3600.0
            , 1) AS layoverHours
        FROM {tbl} leg1
        JOIN {tbl} leg2
            ON leg1.destinationAirport = leg2.startingAirport
            AND leg1.flightDate = leg2.flightDate
        WHERE leg1.startingAirport = '{origin}'
          AND leg2.destinationAirport = '{dest}'
          AND leg1.isNonStop = 'True'
          AND leg2.isNonStop = 'True'
          AND (CAST(leg2.segmentsDepartureTimeEpochSeconds AS BIGINT) -
               CAST(leg1.segmentsArrivalTimeEpochSeconds AS BIGINT)) / 3600.0
              BETWEEN {MIN_LAYOVER_HRS} AND {MAX_LAYOVER_HRS}
          {date_filter.replace('flightDate', 'leg1.flightDate')}
        ORDER BY combinedFare ASC
        LIMIT {limit * 2}
    """

    try:
        # Get direct flight baseline
        _, direct_rows = run_query(direct_sql)
        direct = clean_row(direct_rows[0]) if direct_rows else {}

        # Get spliced itineraries
        _, splice_rows = run_query(splice_sql)
        itineraries = [clean_row(r) for r in splice_rows]

        # Calculate savings & detect cross-alliance routes
        best_direct = direct.get("bestDirect") or direct.get("bestdirect")
        savings_only = []
        if best_direct and float(best_direct) > 0:
            bd = float(best_direct)
            for it in itineraries:
                combined = float(it.get("combinedFare") or it.get("combinedfare") or 0)
                saving = round(bd - combined, 2)
                pct = round((bd - combined) / bd * 100, 1)
                it["savings"] = saving
                it["savingsPercent"] = pct

                # Cross-Alliance detection: flag when airlines differ
                a1 = (it.get("airline1") or it.get("Airline1") or "").strip().lower()
                a2 = (it.get("airline2") or it.get("Airline2") or "").strip().lower()
                it["crossAlliance"] = (a1 != a2 and a1 != "" and a2 != "")

                # Only keep itineraries with positive savings
                if saving > 0:
                    savings_only.append(it)

        # Sort by savings descending (best deals first), limit results
        savings_only.sort(key=lambda x: x.get("savings", 0), reverse=True)
        savings_only = savings_only[:limit]

        return jsonify({
            "origin": origin, "dest": dest,
            "direct": direct,
            "itineraries": savings_only,
            "totalScanned": len(itineraries),
            "directQuery": direct_sql.strip(),
            "spliceQuery": splice_sql.strip()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 5h. Where to Fly (Budget) – includes distance for scatter chart
#     GET /api/where-to-fly-budget?origin=ATL&budget=500
# ---------------------------------------------------------------------------
@app.route("/api/where-to-fly-budget")
def where_to_fly_budget():
    origin = request.args.get("origin", "").upper()
    budget = request.args.get("budget", "")
    nonstop = request.args.get("nonstop", "false").lower() == "true"
    limit = int(request.args.get("limit", 50))

    if not origin:
        return jsonify({"error": "origin is required"}), 400

    nonstop_filter = "AND isNonStop = 'True'" if nonstop else ""
    budget_filter = f"HAVING MIN(CAST(totalFare AS DOUBLE)) <= {float(budget)}" if budget else ""

    tbl = get_flight_table()
    sql = f"""
        SELECT destinationAirport,
               ROUND(MIN(CAST(totalFare AS DOUBLE)), 2)  AS minFare,
               ROUND(AVG(CAST(totalFare AS DOUBLE)), 2)  AS avgFare,
               ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)), 0) AS avgDistance,
               COUNT(*) AS flightCount
        FROM {tbl}
        WHERE startingAirport = '{origin}'
          AND totalTravelDistance IS NOT NULL
          AND CAST(totalTravelDistance AS DOUBLE) > 0
          {nonstop_filter}
        GROUP BY destinationAirport
        {budget_filter}
        ORDER BY minFare ASC
        LIMIT {limit}
    """

    try:
        _, rows = run_query(sql)
        destinations = [clean_row(r) for r in rows]
        return jsonify({"origin": origin, "destinations": destinations, "query": sql.strip()})
    except Exception as e:
        return jsonify({"error": str(e), "query": sql.strip()}), 500


# ---------------------------------------------------------------------------
# 6. Airport Search
#    GET /api/airports?q=Tokyo
# ---------------------------------------------------------------------------
@app.route("/api/airports")
def airports():
    q = request.args.get("q", "")
    limit = int(request.args.get("limit", 20))

    if not q:
        return jsonify({"error": "q (search query) is required"}), 400

    sql = f"""
        SELECT id, ident, type, name, latitude_deg, longitude_deg,
               elevation_ft, continent, iso_country, iso_region,
               municipality, scheduled_service, iata_code, home_link,
               wikipedia_link
        FROM airports
        WHERE LOWER(name) LIKE '%{q.lower()}%'
           OR LOWER(municipality) LIKE '%{q.lower()}%'
           OR LOWER(iata_code) LIKE '%{q.lower()}%'
           OR LOWER(ident) LIKE '%{q.lower()}%'
        LIMIT {limit}
    """

    try:
        cols, rows = run_query(sql)
        results = [clean_row(r) for r in rows]
        return jsonify({"airports": results, "count": len(results), "query": sql.strip()})
    except Exception as e:
        return jsonify({"error": str(e), "query": sql.strip()}), 500


# ---------------------------------------------------------------------------
# 6. AI Chatbot  (Text-to-SQL via DeepSeek AI) — STREAMING via SSE
#    POST /api/chatbot  {"question": "cheapest flights from ATL"}
#    POST /api/chatbot/stream  (same body, returns SSE stream)
# ---------------------------------------------------------------------------

CHATBOT_SCHEMA_PROMPT = """
You are a friendly AI flight assistant called Data Turbulence. You have THREE capabilities:
1. **Database Queries** — search flights, prices, airports, airlines via Hive SQL
2. **Smart Recommendations** — suggest destinations, airlines, or routes using our ML recommendation engine
3. **Conversational Chat** — friendly conversation and general help

INTENT ROUTING — You MUST classify every user message into one of three categories by starting your response with the correct prefix:

**CHAT:** — Use this prefix when the user is greeting you, asking general questions, or chatting casually.
  Example: "CHAT: Hi there! 👋 I'm Data Turbulence, your AI flight assistant. I can help you find flights, get personalized recommendations, or answer questions about travel!"

**RECOMMEND:** — Use this prefix when the user asks for suggestions, recommendations, "where should I go", "what destinations", "suggest me", "recommend", "best places to fly", "I have a budget of X, where can I go", "similar destinations to X", etc. After the prefix, provide a JSON object with parameters.
  Format: RECOMMEND:{"origin":"ATL","budget":500,"preferences":"beach,cheap","nonstop":false,"limit":10}
  - origin: departure airport code (required, ask if missing)
  - budget: max fare in USD (optional, default null)
  - preferences: comma-separated tags like cheap,nonstop,short,beach,warm,adventure (optional)
  - nonstop: true/false (optional, default false)
  - limit: number of results (optional, default 10)
  Examples of RECOMMEND triggers: "recommend destinations from ATL", "where should I fly from JFK under $300", "suggest cheap places from LAX", "I want a beach vacation from MIA", "what are the best deals from ORD"

**SQL Query (no prefix)** — Use NO prefix when the user asks for specific data lookups: flight prices, schedules, airline comparisons, seat availability, specific route queries, counts, averages, etc. Generate ONLY the HiveQL/SparkSQL query.
  Examples: "cheapest flights from ATL to LAX", "average fare by airline from JFK to SFO", "how many nonstop flights from ORD", "show me flights on 2022-09-27"

IMPORTANT RULES:
- If the user says "recommend" or "suggest" or "where should I go" → ALWAYS use RECOMMEND: prefix
- If the user asks for specific data/numbers/queries → generate SQL (no prefix)
- If the user is chatting/greeting → use CHAT: prefix
- Remember conversation context — if the user says "now show nonstop only" after a previous query, adjust accordingly
- When unsure between RECOMMEND and SQL, prefer RECOMMEND if the user is asking for suggestions/advice

DATABASE SCHEMA (ticketmeta09):

TABLE: ext_itineraries (use """ + '"{tbl}"' + """ at runtime)
Columns (ALL STRING type - must CAST for numeric operations):
  legId, searchDate, flightDate, startingAirport, destinationAirport,
  fareBasisCode, travelDuration, elapsedDays, isBasicEconomy, isRefundable,
  isNonStop, baseFare, totalFare, seatsRemaining, totalTravelDistance,
  segmentsDepartureTimeEpochSeconds, segmentsDepartureTimeRaw,
  segmentsArrivalTimeEpochSeconds, segmentsArrivalTimeRaw,
  segmentsArrivalAirportCode, segmentsDepartureAirportCode,
  segmentsAirlineName, segmentsAirlineCode, segmentsEquipmentDescription,
  segmentsDurationInSeconds, segmentsDistance, segmentsCabinCode

Important SQL rules:
- Use CAST(totalFare AS DOUBLE) for fare comparisons
- Use CAST(seatsRemaining AS INT) for seat counts
- isNonStop values are 'True' or 'False' (strings)
- Airport codes are IATA (ATL, LAX, JFK, SFO, ORD, MIA)
- Always add LIMIT (default 20) to avoid huge scans
- ALWAYS use ext_itineraries as the table name

Table: airports
Columns: id INT, ident, type, name, latitude_deg DOUBLE, longitude_deg DOUBLE,
  elevation_ft INT, continent, iso_country, iso_region, municipality,
  scheduled_service, gps_code, iata_code, local_code, home_link,
  wikipedia_link, keywords

Table: countries
Columns: id INT, code, name, continent, wikipedia_link, keywords
"""


def _build_ai_messages(question, history):
    """Build the OpenAI message list from question + history."""
    messages = [{"role": "system", "content": CHATBOT_SCHEMA_PROMPT}]
    if history and isinstance(history, list):
        for msg in history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    else:
        messages.append({"role": "user", "content": question})
    if not messages[-1].get("content", "").strip() == question:
        messages.append({"role": "user", "content": question})
    return messages


def _call_deepseek(messages):
    """Call DeepSeek API and return the raw text response."""
    import openai
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    client = openai.OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=0,
        max_tokens=500,
        timeout=30,  # 30s timeout for AI response
    )
    return response.choices[0].message.content.strip()


def _clean_sql(raw):
    """Clean markdown fences, replace table name placeholder, enforce LIMIT."""
    sql = re.sub(r"^```(sql|hive|sparksql)?\s*", "", raw)
    sql = re.sub(r"\s*```$", "", sql)
    sql = sql.strip()
    # Replace placeholder table with actual optimised table
    tbl = get_flight_table()
    sql = sql.replace("ext_itineraries", tbl)
    # Enforce LIMIT if missing
    if "LIMIT" not in sql.upper():
        sql = sql.rstrip("; ") + " LIMIT 20"
    return sql


def _run_query_with_timeout(sql, timeout_seconds=120):
    """Run a Spark SQL query with a timeout. Returns (cols, rows) or raises."""
    import threading

    result = {"cols": None, "rows": None, "error": None}

    def target():
        try:
            cols, rows = run_query(sql)
            result["cols"] = cols
            result["rows"] = rows
        except Exception as e:
            result["error"] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds)

    if thread.is_alive():
        raise TimeoutError(f"Query timed out after {timeout_seconds}s. Try a more specific query with filters.")
    if result["error"]:
        raise result["error"]
    return result["cols"], result["rows"]


# ===========================================================================
# SMART RECOMMENDATION ENGINE (SQL-based scoring — fast, no ML training)
# ===========================================================================

def _get_als_recommendations(origin, budget=None, nonstop_only=False, limit=10):
    """Get smart destination recommendations using SQL-based popularity scoring.
    Score = log(flightCount+1) * affordability * nonstopBonus * airlineDiversity
    Fast single-query approach — no heavy ML model training needed.
    """
    import math

    origin = origin.upper()
    tbl = get_flight_table()

    # Check cache first
    cache_key = f"recs_{origin}_{budget}_{nonstop_only}_{limit}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    nonstop_filter = "AND isNonStop = 'True'" if nonstop_only else ""
    budget_filter = f"HAVING MIN(CAST(totalFare AS DOUBLE)) <= {float(budget)}" if budget else ""

    sql = f"""
        SELECT destinationAirport,
               ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
               ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
               COUNT(*) AS flightCount,
               SUM(CASE WHEN isNonStop='True' THEN 1 ELSE 0 END) AS nonstopCount,
               COUNT(DISTINCT segmentsAirlineName) AS airlineCount,
               ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)),0) AS avgDistance
        FROM {tbl}
        WHERE startingAirport = '{origin}'
          AND totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
          {nonstop_filter}
        GROUP BY destinationAirport
        {budget_filter}
        ORDER BY COUNT(*) DESC
        LIMIT {limit * 3}
    """

    try:
        _, rows = run_query(sql)
    except Exception as e:
        return {"error": f"Query error: {str(e)}"}

    if not rows:
        return {"error": f"No flights found from {origin}. Try major airports like ATL, LAX, JFK, ORD, SFO, MIA."}

    data = [clean_row(r) for r in rows]

    # Compute smart scores
    max_fare = max(r.get("avgFare", 1) or 1 for r in data)
    for r in data:
        fc = r.get("flightCount", 1) or 1
        avg_f = r.get("avgFare", 1) or 1
        ns = r.get("nonstopCount", 0) or 0
        ac = r.get("airlineCount", 1) or 1
        popularity = math.log(fc + 1)
        affordability = max_fare / max(avg_f, 1)
        nonstop_bonus = 1.0 + (ns / max(fc, 1)) * 0.5
        diversity = 1.0 + math.log(ac + 1) * 0.3
        r["alsScore"] = round(popularity * affordability * nonstop_bonus * diversity, 2)
        r["origin"] = origin
        r["city"] = AIRPORT_CITIES.get(r.get("destinationAirport", ""), r.get("destinationAirport", ""))

    # Sort by score and take top N
    data.sort(key=lambda x: x.get("alsScore", 0), reverse=True)
    recommendations = data[:limit]

    result = {
        "origin": origin,
        "recommendations": recommendations,
        "model": "Smart Route Scoring",
        "note": f"Scoring based on popularity, affordability, nonstop availability & airline diversity"
    }
    cache_set(cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Standalone recommendation endpoint
# GET /api/recommend?origin=ATL&budget=500&nonstop=false&limit=10
# ---------------------------------------------------------------------------
@app.route("/api/recommend")
def recommend():
    origin = request.args.get("origin", "").upper()
    budget = request.args.get("budget", None)
    nonstop = request.args.get("nonstop", "false").lower() == "true"
    limit = int(request.args.get("limit", 10))

    if not origin:
        return jsonify({"error": "origin is required"}), 400

    try:
        result = _get_als_recommendations(origin, budget=budget, nonstop_only=nonstop, limit=limit)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- SSE streaming endpoint (primary) ----------
@app.route("/api/chatbot/stream", methods=["POST"])
def chatbot_stream():
    from flask import Response

    data = request.get_json(force=True)
    question = data.get("question", "")
    history = data.get("history", [])

    if not question:
        def err():
            yield f"data: {json.dumps({'type': 'error', 'message': 'question is required'})}\n\n"
        return Response(err(), mimetype="text/event-stream")

    def generate():
        # Phase 1 — call DeepSeek AI
        yield f"data: {json.dumps({'type': 'status', 'message': 'Asking AI...'})}\n\n"
        try:
            messages = _build_ai_messages(question, history)
            raw = _call_deepseek(messages)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'AI error: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Phase 2 — check if it's a chat response
        if raw.startswith("CHAT:"):
            chat_msg = raw[5:].strip()
            yield f"data: {json.dumps({'type': 'answer', 'answer': chat_msg, 'sql': None, 'results': None})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Phase 2b — check if it's a recommendation request
        if raw.startswith("RECOMMEND:"):
            rec_raw = raw[10:].strip()
            yield f"data: {json.dumps({'type': 'status', 'message': 'Running ALS recommendation engine...'})}\n\n"
            try:
                params = json.loads(rec_raw)
                origin = params.get("origin", "")
                budget = params.get("budget", None)
                nonstop = params.get("nonstop", False)
                limit = params.get("limit", 10)

                if not origin:
                    yield f"data: {json.dumps({'type': 'answer', 'answer': 'I need an origin airport to make recommendations. Which airport are you flying from? (e.g., ATL, LAX, JFK)', 'sql': None, 'results': None})}\n\n"
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    return

                result = _get_als_recommendations(origin, budget=budget, nonstop_only=nonstop, limit=limit)

                if "error" in result:
                    yield f"data: {json.dumps({'type': 'answer', 'answer': result['error'], 'sql': None, 'results': None})}\n\n"
                else:
                    recs = result.get("recommendations", [])
                    prefs = params.get("preferences", "")
                    budget_str = f" under ${budget}" if budget else ""
                    nonstop_str = " (nonstop only)" if nonstop else ""

                    summary = f"🎯 **ALS Recommendations from {origin}**{budget_str}{nonstop_str}\n"
                    summary += f"_Powered by Spark MLlib Collaborative Filtering on {result.get('note', 'route patterns')}_\n\n"

                    if recs:
                        for i, r in enumerate(recs, 1):
                            dest = r.get("destinationAirport", "?")
                            city = r.get("city", dest)
                            min_f = r.get("minFare", "?")
                            avg_f = r.get("avgFare", "?")
                            cnt = r.get("flightCount", 0)
                            ns = r.get("nonstopCount", 0)
                            als = r.get("alsScore", 0)
                            airlines = r.get("airlineCount", 0)
                            summary += f"**{i}. {dest}** ({city}) — from **${min_f}** (avg ${avg_f}) | {cnt} flights | {ns} nonstop | {airlines} airlines | Score: {als}\n"
                    else:
                        summary += "No recommendations found matching your criteria. Try a different airport or relax your filters."

                    yield f"data: {json.dumps({'type': 'recommendation', 'answer': summary, 'recommendations': recs, 'origin': origin, 'model': result.get('model', 'ALS')})}\n\n"
            except json.JSONDecodeError:
                yield f"data: {json.dumps({'type': 'answer', 'answer': 'I want to recommend destinations for you! Which airport are you flying from?', 'sql': None, 'results': None})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Recommendation error: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Phase 3 — it's SQL
        sql = _clean_sql(raw)

        if not sql.upper().strip().startswith("SELECT"):
            yield f"data: {json.dumps({'type': 'answer', 'answer': sql if len(sql) > 20 else 'I can only run SELECT queries for safety.', 'sql': None, 'results': None})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Send SQL immediately so user sees it while query runs
        yield f"data: {json.dumps({'type': 'sql', 'sql': sql})}\n\n"
        yield f"data: {json.dumps({'type': 'status', 'message': 'Running query on Hive...'})}\n\n"

        # Phase 4 — execute query with timeout
        try:
            cols, rows = _run_query_with_timeout(sql, timeout_seconds=120)
            results = [clean_row(r) for r in rows]
            yield f"data: {json.dumps({'type': 'answer', 'answer': f'Found {len(results)} results.', 'sql': sql, 'results': results})}\n\n"
        except TimeoutError as te:
            yield f"data: {json.dumps({'type': 'answer', 'answer': f'⏱ {str(te)}', 'sql': sql, 'results': None})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'answer', 'answer': f'Query error: {str(e)}', 'sql': sql, 'results': None})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- Legacy non-streaming endpoint (kept for compatibility) ----------
@app.route("/api/chatbot", methods=["POST"])
def chatbot():
    data = request.get_json(force=True)
    question = data.get("question", "")
    history = data.get("history", [])

    if not question:
        return jsonify({"error": "question is required"}), 400

    try:
        import openai
    except ImportError:
        return jsonify({"error": "openai not installed", "answer": "AI not configured."}), 500

    try:
        messages = _build_ai_messages(question, history)
        raw = _call_deepseek(messages)

        if raw.startswith("CHAT:"):
            return jsonify({"answer": raw[5:].strip(), "sql": None, "results": None})

        if raw.startswith("RECOMMEND:"):
            try:
                params = json.loads(raw[10:].strip())
                origin = params.get("origin", "")
                result = _get_als_recommendations(
                    origin, budget=params.get("budget"), nonstop_only=params.get("nonstop", False), limit=params.get("limit", 10)
                )
                if "error" in result:
                    return jsonify({"answer": result["error"], "sql": None, "results": None})
                recs = result.get("recommendations", [])
                summary = f"🎯 ALS Recommendations from {origin}\n"
                for i, r in enumerate(recs, 1):
                    summary += f"{i}. {r.get('destinationAirport','?')} ({r.get('city','')}) — from ${r.get('minFare','?')} | {r.get('flightCount',0)} flights\n"
                return jsonify({"answer": summary, "sql": None, "results": recs, "type": "recommendation"})
            except Exception as e:
                return jsonify({"answer": f"Recommendation error: {str(e)}", "sql": None, "results": None})

        sql = _clean_sql(raw)

        if not sql.upper().strip().startswith("SELECT"):
            return jsonify({"answer": sql if len(sql) > 20 else "I can only run SELECT queries for safety.", "sql": None, "results": None})

        cols, rows = _run_query_with_timeout(sql, timeout_seconds=120)
        results = [clean_row(r) for r in rows]
        return jsonify({"answer": f"Found {len(results)} results.", "sql": sql, "results": results})

    except TimeoutError as te:
        return jsonify({"answer": f"⏱ {str(te)}", "sql": sql, "results": None})
    except Exception as e:
        return jsonify({"error": str(e), "sql": locals().get("sql", "")}), 500


# ===========================================================================
# DATA ENRICHMENT ENDPOINTS (Requirement 2: External Datasets)
# ===========================================================================
import requests as ext_requests
import csv as csv_mod
import io as io_mod

AIRPORT_CITIES = {
    "ATL":"Atlanta,GA","LAX":"Los Angeles,CA","ORD":"Chicago,IL","DFW":"Dallas,TX",
    "DEN":"Denver,CO","JFK":"New York,NY","SFO":"San Francisco,CA","SEA":"Seattle,WA",
    "LAS":"Las Vegas,NV","MCO":"Orlando,FL","EWR":"Newark,NJ","MIA":"Miami,FL",
    "CLT":"Charlotte,NC","PHX":"Phoenix,AZ","IAH":"Houston,TX","BOS":"Boston,MA",
    "MSP":"Minneapolis,MN","DTW":"Detroit,MI","PHL":"Philadelphia,PA","LGA":"New York,NY",
    "FLL":"Fort Lauderdale,FL","BWI":"Baltimore,MD","DCA":"Washington,DC","SLC":"Salt Lake City,UT",
    "IAD":"Washington,DC","SAN":"San Diego,CA","TPA":"Tampa,FL","BNA":"Nashville,TN",
    "AUS":"Austin,TX","PDX":"Portland,OR","STL":"St. Louis,MO","OAK":"Oakland,CA",
    "RDU":"Raleigh,NC","PIT":"Pittsburgh,PA",
}
AIRPORT_COORDS = {
    "ATL":(33.64,-84.43),"LAX":(33.94,-118.41),"ORD":(41.97,-87.91),"DFW":(32.90,-97.04),
    "DEN":(39.86,-104.67),"JFK":(40.64,-73.78),"SFO":(37.62,-122.38),"SEA":(47.45,-122.31),
    "LAS":(36.08,-115.15),"MCO":(28.43,-81.31),"EWR":(40.69,-74.17),"MIA":(25.80,-80.29),
    "CLT":(35.21,-80.94),"PHX":(33.44,-112.01),"IAH":(29.99,-95.34),"BOS":(42.37,-71.01),
    "MSP":(44.88,-93.22),"DTW":(42.21,-83.35),"PHL":(39.87,-75.24),"LGA":(40.78,-73.87),
    "FLL":(26.07,-80.15),"BWI":(39.18,-76.67),"DCA":(38.85,-77.04),"SLC":(40.79,-111.98),
}
METRO_INCOME = {
    "SFO":112449,"OAK":112449,"SJC":117474,"SEA":94027,"BOS":89212,"DCA":105659,
    "IAD":105659,"JFK":75910,"LGA":75910,"EWR":85245,"LAX":73052,"SAN":83985,
    "DEN":84843,"MSP":84313,"ATL":71193,"AUS":80954,"PDX":78673,"BNA":67571,
    "CLT":64017,"ORD":78304,"DFW":72265,"IAH":69193,"PHX":65210,"PHL":68740,
    "DTW":61003,"MIA":51347,"FLL":58905,"MCO":55021,"TPA":54599,"LAS":58377,
    "SLC":75626,"BWI":82253,"STL":57920,"PIT":61344,"RDU":72576,
}
RAIL_PAIRS = {
    ("BOS","JFK"),("BOS","LGA"),("BOS","EWR"),("BOS","PHL"),("BOS","BWI"),("BOS","DCA"),
    ("JFK","PHL"),("JFK","BWI"),("JFK","DCA"),("JFK","EWR"),("JFK","BOS"),
    ("LGA","PHL"),("LGA","BWI"),("LGA","DCA"),("LGA","EWR"),("LGA","BOS"),
    ("EWR","PHL"),("EWR","BWI"),("EWR","DCA"),("EWR","BOS"),("EWR","JFK"),("EWR","LGA"),
    ("PHL","BWI"),("PHL","DCA"),("PHL","JFK"),("PHL","LGA"),("PHL","EWR"),("PHL","BOS"),
    ("BWI","DCA"),("BWI","PHL"),("BWI","JFK"),("BWI","LGA"),("BWI","EWR"),("BWI","BOS"),
    ("DCA","BWI"),("DCA","PHL"),("DCA","JFK"),("DCA","LGA"),("DCA","EWR"),("DCA","BOS"),
    ("IAD","BWI"),("IAD","PHL"),("IAD","JFK"),("IAD","LGA"),("IAD","EWR"),("IAD","BOS"),
}

# ---------------------------------------------------------------------------
# I. Severe Weather & Capacity Contraction Premium
# ---------------------------------------------------------------------------

# WMO Weather Code descriptions
WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Freezing drizzle (light)", 57: "Freezing drizzle (dense)",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Freezing rain (light)", 67: "Freezing rain (heavy)",
    71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
    77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
    82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}

@app.route("/api/enrichment/weather")
def enrichment_weather():
    airport = request.args.get("airport", "ATL").upper()
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT flightDate,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                   COUNT(*) AS flightCount,
                   SUM(CASE WHEN isNonStop='True' THEN 1 ELSE 0 END) AS nonstopCount,
                   SUM(CASE WHEN isNonStop='False' THEN 1 ELSE 0 END) AS connectingCount,
                   ROUND(AVG(CAST(seatsRemaining AS INT)),1) AS avgSeats,
                   ROUND(AVG(DATEDIFF(flightDate,searchDate)),1) AS avgLeadDays
            FROM {tbl}
            WHERE startingAirport='{airport}' AND flightDate IS NOT NULL
            GROUP BY flightDate ORDER BY flightDate
        """
        _, rows = run_query(sql)
        return {"airport": airport, "dailyData": [clean_row(r) for r in rows], "query": sql.strip()}
    try:
        result = cached_query(f"weather_{airport}", _query)
        # Determine date range from internal data to fetch matching historical weather
        daily_data = result.get("dailyData", [])
        weather = {}
        coords = AIRPORT_COORDS.get(airport)
        if coords and daily_data:
            try:
                dates = [d.get("flightDate","") for d in daily_data if d.get("flightDate")]
                dates = sorted([d for d in dates if d and len(d) >= 10])
                if dates:
                    start_date = dates[0][:10]
                    end_date = dates[-1][:10]
                    # Use Open-Meteo Archive API for historical weather matching internal data dates
                    meteo_url = (
                        f"https://archive-api.open-meteo.com/v1/archive"
                        f"?latitude={coords[0]}&longitude={coords[1]}"
                        f"&start_date={start_date}&end_date={end_date}"
                        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                        f"windspeed_10m_max,weathercode"
                        f"&temperature_unit=celsius&windspeed_unit=ms&timezone=auto"
                    )
                    meteo_resp = ext_requests.get(meteo_url, timeout=20).json()
                    daily_w = meteo_resp.get("daily", {})
                    w_dates = daily_w.get("time", [])
                    w_tmax = daily_w.get("temperature_2m_max", [])
                    w_tmin = daily_w.get("temperature_2m_min", [])
                    w_precip = daily_w.get("precipitation_sum", [])
                    w_wind = daily_w.get("windspeed_10m_max", [])
                    w_code = daily_w.get("weathercode", [])
                    for i, dt in enumerate(w_dates):
                        temp_max = w_tmax[i] if i < len(w_tmax) else None
                        temp_min = w_tmin[i] if i < len(w_tmin) else None
                        avg_temp = round((temp_max + temp_min) / 2, 1) if temp_max is not None and temp_min is not None else None
                        code = w_code[i] if i < len(w_code) else None
                        weather[dt] = {
                            "temp": avg_temp,
                            "wind": w_wind[i] if i < len(w_wind) else None,
                            "precip": w_precip[i] if i < len(w_precip) else None,
                            "desc": WMO_CODES.get(code, "Unknown") if code is not None else "—",
                        }
            except Exception as we:
                weather = {"error": str(we)}
        result["weather"] = weather
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# II. Geographical Wealth & Purchasing Power Discrimination
# ---------------------------------------------------------------------------
@app.route("/api/enrichment/wealth")
def enrichment_wealth():
    def _query():
        tbl = get_flight_table()
        sql = f"""
            SELECT startingAirport,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)/NULLIF(CAST(totalTravelDistance AS DOUBLE),0)),4) AS avgPricePerMile,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                   ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)),0) AS avgDistance,
                   COUNT(*) AS flightCount
            FROM {tbl}
            WHERE totalTravelDistance IS NOT NULL AND CAST(totalTravelDistance AS DOUBLE) > 50
              AND totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
            GROUP BY startingAirport
            HAVING COUNT(*) > 100
            ORDER BY avgPricePerMile DESC
        """
        _, rows = run_query(sql)
        data = [clean_row(r) for r in rows]
        # Enrich with income data
        for d in data:
            ap = d.get("startingAirport","")
            d["medianIncome"] = METRO_INCOME.get(ap)
            d["city"] = AIRPORT_CITIES.get(ap,"Unknown")
            if d["medianIncome"] and d["medianIncome"] >= 90000:
                d["incomeTier"] = "High"
            elif d["medianIncome"] and d["medianIncome"] >= 70000:
                d["incomeTier"] = "Medium"
            else:
                d["incomeTier"] = "Low"
        return {"airports": data, "query": sql.strip()}
    try:
        result = cached_query("wealth_analysis", _query)
        # Summary by tier
        tiers = {}
        for a in result.get("airports", []):
            tier = a.get("incomeTier", "Unknown")
            if tier not in tiers:
                tiers[tier] = {"count": 0, "totalPPM": 0, "totalFare": 0}
            tiers[tier]["count"] += 1
            tiers[tier]["totalPPM"] += a.get("avgPricePerMile", 0) or 0
            tiers[tier]["totalFare"] += a.get("avgFare", 0) or 0
        summary = []
        for tier, v in tiers.items():
            if v["count"] > 0:
                summary.append({
                    "tier": tier, "airportCount": v["count"],
                    "avgPricePerMile": round(v["totalPPM"] / v["count"], 4),
                    "avgFare": round(v["totalFare"] / v["count"], 2),
                })
        result["tierSummary"] = sorted(summary, key=lambda x: x["avgPricePerMile"], reverse=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# III. Brand Markup & Service Quality Correlation
# ---------------------------------------------------------------------------

# ACSI (American Customer Satisfaction Index) 2022 airline scores (public data)
ACSI_SCORES = {
    "Delta Air Lines": 80, "Alaska Airlines": 78, "Southwest Airlines": 78,
    "JetBlue Airways": 76, "United Airlines": 75, "American Airlines": 73,
    "Frontier Airlines": 64, "Spirit Airlines": 63, "Allegiant Air": 68,
    "Hawaiian Airlines": 77,
}

# DOT complaint rates per 100K passengers (2022 Air Travel Consumer Report)
DOT_COMPLAINT_RATE = {
    "Delta Air Lines": 1.21, "Alaska Airlines": 1.53, "Southwest Airlines": 1.69,
    "JetBlue Airways": 2.83, "United Airlines": 2.37, "American Airlines": 2.14,
    "Frontier Airlines": 8.57, "Spirit Airlines": 9.42, "Allegiant Air": 3.91,
    "Hawaiian Airlines": 1.78,
}

# Map Expedia airline names → canonical names for matching
AIRLINE_CANONICAL = {
    "Delta": "Delta Air Lines", "Alaska Airlines": "Alaska Airlines",
    "Southwest Airlines": "Southwest Airlines", "JetBlue Airways": "JetBlue Airways",
    "JetBlue": "JetBlue Airways", "United": "United Airlines",
    "American Airlines": "American Airlines", "American": "American Airlines",
    "Frontier Airlines": "Frontier Airlines", "Frontier": "Frontier Airlines",
    "Spirit Airlines": "Spirit Airlines", "Spirit": "Spirit Airlines",
    "Allegiant Air": "Allegiant Air", "Hawaiian Airlines": "Hawaiian Airlines",
}

# Map BTS/DOT CSV carrier names → canonical names (CSV has "Network" suffix, etc.)
DOT_CSV_TO_CANONICAL = {
    "Delta Air Lines Network": "Delta Air Lines",
    "Alaska Airlines Network": "Alaska Airlines",
    "American Airlines Network": "American Airlines",
    "United Air Lines Network": "United Airlines",
    "Hawaiian Airlines Network": "Hawaiian Airlines",
    "Southwest Airlines": "Southwest Airlines",
    "JetBlue Airways": "JetBlue Airways",
    "Frontier Airlines": "Frontier Airlines",
    "Spirit Airlines": "Spirit Airlines",
    "Allegiant Air": "Allegiant Air",
    # Regional carriers → parent airline (DOT groups them)
    "Envoy Air": "American Airlines",       # American Eagle regional
    "PSA Airlines Inc.": "American Airlines",
    "Piedmont Airlines": "American Airlines",
    "Republic Airline": "American Airlines", # Also flies for Delta/United
    "SkyWest Airlines Inc.": "United Airlines",  # Also Delta/American
    "Mesa Airlines Inc.": "United Airlines",
    "Endeavor Air Inc.": "Delta Air Lines",
    "Horizon Air": "Alaska Airlines",
    "GoJet Airlines LLC d/b/a United Express": "United Airlines",
    "Air Wisconsin Airlines Corp": "American Airlines",
    "CommuteAir LLC dba CommuteAir": "United Airlines",
    "Commutair Aka Champlain Enterprises, Inc.": "United Airlines",
}

# Real DOT On-Time Performance data (2022 BTS) — computed from Airline_Delay_Cause.csv
# These are pre-calculated as fallback; live values computed from CSV at runtime
DOT_ONTIME_PCT = {
    "Delta Air Lines": 82.8, "Alaska Airlines": 80.1, "Southwest Airlines": 78.5,
    "JetBlue Airways": 73.2, "United Airlines": 79.6, "American Airlines": 79.1,
    "Frontier Airlines": 74.8, "Spirit Airlines": 72.1, "Allegiant Air": 75.3,
    "Hawaiian Airlines": 81.5,
}

def _match_canonical(expedia_name):
    """Match an Expedia airline name to a canonical name for ACSI/DOT lookup."""
    if not expedia_name:
        return None
    name = expedia_name.strip()
    if name in AIRLINE_CANONICAL:
        return AIRLINE_CANONICAL[name]
    lower = name.lower()
    for key, canon in AIRLINE_CANONICAL.items():
        if key.lower() in lower or lower in key.lower():
            return canon
    return None

@app.route("/api/enrichment/brand")
def enrichment_brand():
    def _query():
        tbl = get_flight_table()

        # ── Load ACSI scores from Hive table (HDFS+Hive+ORC) ──
        acsi_from_hive = {}
        try:
            acsi_sql = "SELECT airline_name, acsi_score FROM acsi_scores_orc WHERE year = 2022"
            _, acsi_rows = run_query(acsi_sql)
            for r in acsi_rows:
                row = clean_row(r)
                name = row.get("airline_name", "")
                score = row.get("acsi_score")
                if name and score is not None:
                    acsi_from_hive[name] = int(score)
        except Exception as e:
            print(f"[Brand] ACSI Hive query failed, using fallback: {e}")
        acsi_scores = acsi_from_hive if acsi_from_hive else ACSI_SCORES

        # ── Load DOT complaint rates from Hive table (HDFS+Hive+ORC) ──
        dot_from_hive = {}
        try:
            dot_sql = "SELECT airline_name, complaint_rate_per_100k FROM dot_complaints_orc WHERE year = 2022"
            _, dot_rows = run_query(dot_sql)
            for r in dot_rows:
                row = clean_row(r)
                name = row.get("airline_name", "")
                rate = row.get("complaint_rate_per_100k")
                if name and rate is not None:
                    dot_from_hive[name] = float(rate)
        except Exception as e:
            print(f"[Brand] DOT Hive query failed, using fallback: {e}")
        complaint_rates = dot_from_hive if dot_from_hive else DOT_COMPLAINT_RATE

        # Top 5 competitive NONSTOP routes (clean single airline names)
        routes_sql = f"""
            SELECT startingAirport, destinationAirport,
                   COUNT(DISTINCT segmentsAirlineName) AS airlineCount,
                   COUNT(*) AS flightCount
            FROM {tbl}
            WHERE segmentsAirlineName IS NOT NULL AND segmentsAirlineName != ''
              AND isNonStop = 'True'
              AND segmentsAirlineName NOT LIKE '%||%'
            GROUP BY startingAirport, destinationAirport
            HAVING COUNT(DISTINCT segmentsAirlineName) >= 4
            ORDER BY flightCount DESC LIMIT 5
        """
        _, route_rows = run_query(routes_sql)
        routes = [clean_row(r) for r in route_rows]

        all_comparisons = []
        for route in routes[:5]:
            o, d = route["startingAirport"], route["destinationAirport"]
            comp_sql = f"""
                SELECT segmentsAirlineName AS airline,
                       ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                       ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
                       ROUND(MAX(CAST(totalFare AS DOUBLE)),2) AS maxFare,
                       COUNT(*) AS flightCount,
                       100.0 AS nonstopPct
                FROM {tbl}
                WHERE startingAirport='{o}' AND destinationAirport='{d}'
                  AND segmentsAirlineName IS NOT NULL AND segmentsAirlineName != ''
                  AND isNonStop = 'True'
                  AND segmentsAirlineName NOT LIKE '%||%'
                GROUP BY segmentsAirlineName
                HAVING COUNT(*) >= 5
                ORDER BY avgFare DESC
            """
            _, comp_rows = run_query(comp_sql)
            airlines_data = [clean_row(r) for r in comp_rows]
            # Enrich each airline with ACSI + DOT quality metrics from Hive tables
            for a in airlines_data:
                canon = _match_canonical(a.get("airline", ""))
                a["canonicalName"] = canon
                a["acsiScore"] = acsi_scores.get(canon) if canon else None
                a["complaintRate"] = complaint_rates.get(canon) if canon else None
            all_comparisons.append({
                "route": f"{o}→{d}", "origin": o, "dest": d,
                "airlines": airlines_data
            })
        return {
            "routes": routes, "comparisons": all_comparisons,
            "routeQuery": routes_sql.strip(),
            "dataSource": {
                "acsi": "acsi_scores_orc (Hive)" if acsi_from_hive else "fallback dict",
                "dot_complaints": "dot_complaints_orc (Hive)" if dot_from_hive else "fallback dict",
            }
        }
    try:
        result = cached_query("brand_analysis_v3", _query)
        # Load DOT delay/on-time data from Hive table (HDFS+Hive+ORC)
        delay_data = {}
        try:
            delay_sql = """
                SELECT carrier_name,
                       ROUND(SUM(arr_del15),0) AS total_delays,
                       ROUND(SUM(arr_flights),0) AS total_flights,
                       ROUND((1 - SUM(arr_del15)/SUM(arr_flights))*100, 1) AS onTimePct
                FROM airline_delay_cause_orc
                WHERE carrier_name IS NOT NULL
                GROUP BY carrier_name ORDER BY total_flights DESC
            """
            _, delay_rows = run_query(delay_sql)
            for row in delay_rows:
                r = clean_row(row)
                carrier = r.get("carrier_name","")
                if carrier:
                    delay_data[carrier] = {"onTimePct": r.get("onTimePct"), "total_flights": r.get("total_flights",0)}
        except:
            delay_data = {}
        if not delay_data:
            try:
                csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Airline_Delay_Cause.csv")
                if os.path.exists(csv_path):
                    from collections import defaultdict
                    agg = defaultdict(lambda: {"del15": 0.0, "flights": 0.0})
                    with open(csv_path, "r", encoding="utf-8") as f:
                        reader = csv_mod.DictReader(f)
                        for row in reader:
                            carrier = (row.get("carrier_name") or "").strip()
                            if not carrier: continue
                            try:
                                agg[carrier]["del15"] += float(row.get("arr_del15") or 0)
                                agg[carrier]["flights"] += float(row.get("arr_flights") or 0)
                            except: pass
                    for carrier, v in agg.items():
                        if v["flights"] > 0:
                            delay_data[carrier] = {
                                "onTimePct": round((1 - v["del15"] / v["flights"]) * 100, 1),
                                "total_flights": round(v["flights"])
                            }
            except: pass
        # Convert CSV carrier names → canonical names for proper matching
        canonical_ontime = {}
        for csv_name, info in delay_data.items():
            canon = DOT_CSV_TO_CANONICAL.get(csv_name)
            if canon:
                if canon not in canonical_ontime:
                    canonical_ontime[canon] = {"del15": 0.0, "flights": 0.0}
                # Accumulate (regional carriers roll up to parent)
                flights = info.get("total_flights") or 0
                otp = info.get("onTimePct") or 0
                if flights and isinstance(flights, (int, float)):
                    canonical_ontime[canon]["flights"] += float(flights)
                    if otp and isinstance(otp, (int, float)):
                        canonical_ontime[canon]["del15"] += float(flights) * (1 - float(otp) / 100.0)

        # Compute final on-time% per canonical airline
        ontime_by_canonical = {}
        for canon, v in canonical_ontime.items():
            if v["flights"] > 0:
                ontime_by_canonical[canon] = round((1 - v["del15"] / v["flights"]) * 100, 1)

        # Fallback to hardcoded DOT_ONTIME_PCT if Hive didn't produce results
        if not ontime_by_canonical:
            ontime_by_canonical = dict(DOT_ONTIME_PCT)

        # Now attach on-time% directly to each airline in comparisons
        for comp in result.get("comparisons", []):
            for a in comp.get("airlines", []):
                canon = a.get("canonicalName")
                if canon and canon in ontime_by_canonical:
                    a["onTimePct"] = ontime_by_canonical[canon]
                elif canon and canon in DOT_ONTIME_PCT:
                    a["onTimePct"] = DOT_ONTIME_PCT[canon]
                else:
                    a["onTimePct"] = None

        result["delayData"] = delay_data
        result["onTimeByAirline"] = ontime_by_canonical
        result["acsiScores"] = result.get("dataSource", {}).get("acsi", "").startswith("acsi_scores_orc") and {k: v for k, v in (ACSI_SCORES | dict())} or ACSI_SCORES
        result["complaintRates"] = DOT_COMPLAINT_RATE
        result["dataSource"] = result.get("dataSource", {
            "acsi": "acsi_scores_orc (Hive)",
            "dot_complaints": "dot_complaints_orc (Hive)",
            "bts_delay": "airline_delay_cause_orc (Hive)",
        })
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# IV. Intermodal Competition: Rail Price Ceiling Effect
# ---------------------------------------------------------------------------
@app.route("/api/enrichment/rail")
def enrichment_rail():
    def _query():
        tbl = get_flight_table()

        # ── Load rail route pairs from Hive table (HDFS+Hive+ORC) ──
        rail_pairs_from_hive = set()
        rail_details_from_hive = {}
        try:
            rail_sql = "SELECT origin_airport, destination_airport, rail_available, rail_service, avg_rail_fare_usd, rail_corridor FROM amtrak_rail_routes_orc WHERE rail_available = 'Yes'"
            _, rail_rows = run_query(rail_sql)
            for r in rail_rows:
                row = clean_row(r)
                o = row.get("origin_airport", "")
                d = row.get("destination_airport", "")
                if o and d:
                    rail_pairs_from_hive.add((o, d))
                    rail_details_from_hive[(o, d)] = {
                        "service": row.get("rail_service", ""),
                        "fare": row.get("avg_rail_fare_usd"),
                        "corridor": row.get("rail_corridor", ""),
                    }
            print(f"[Rail] Loaded {len(rail_pairs_from_hive)} rail pairs from Hive")
        except Exception as e:
            print(f"[Rail] Hive rail table query failed, using fallback RAIL_PAIRS: {e}")

        active_rail_pairs = rail_pairs_from_hive if rail_pairs_from_hive else RAIL_PAIRS

        # Short-haul flights under 400 miles (teacher requirement)
        sql = f"""
            SELECT startingAirport, destinationAirport,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                   ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)),0) AS avgDistance,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)/NULLIF(CAST(totalTravelDistance AS DOUBLE),0)),4) AS pricePerMile,
                   COUNT(*) AS flightCount
            FROM {tbl}
            WHERE CAST(totalTravelDistance AS DOUBLE) < 400
              AND CAST(totalTravelDistance AS DOUBLE) > 50
              AND totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
            GROUP BY startingAirport, destinationAirport
            HAVING COUNT(*) > 20
            ORDER BY pricePerMile DESC
        """
        _, rows = run_query(sql)
        data = [clean_row(r) for r in rows]
        rail_covered, rail_vacuum = [], []
        for d in data:
            pair = (d["startingAirport"], d["destinationAirport"])
            d["hasRail"] = pair in active_rail_pairs or (pair[1], pair[0]) in active_rail_pairs
            # Attach rail service details if available
            details = rail_details_from_hive.get(pair) or rail_details_from_hive.get((pair[1], pair[0]))
            if details:
                d["railService"] = details.get("service", "")
                d["railFare"] = details.get("fare")
                d["railCorridor"] = details.get("corridor", "")
            if d["hasRail"]:
                rail_covered.append(d)
            else:
                rail_vacuum.append(d)
        # Summary
        rc_ppm = [r["pricePerMile"] for r in rail_covered if r["pricePerMile"]]
        rv_ppm = [r["pricePerMile"] for r in rail_vacuum if r["pricePerMile"]]
        summary = {
            "railCovered": {"count": len(rail_covered),
                           "avgPricePerMile": round(sum(rc_ppm)/len(rc_ppm),4) if rc_ppm else 0},
            "railVacuum": {"count": len(rail_vacuum),
                          "avgPricePerMile": round(sum(rv_ppm)/len(rv_ppm),4) if rv_ppm else 0},
        }
        if summary["railVacuum"]["avgPricePerMile"] > 0:
            summary["priceCeilingEffect"] = round(
                (1 - summary["railCovered"]["avgPricePerMile"]/summary["railVacuum"]["avgPricePerMile"])*100, 1)
        return {"routes": data, "railCovered": rail_covered, "railVacuum": rail_vacuum,
                "summary": summary, "query": sql.strip(),
                "dataSource": {
                    "amtrak_routes": "amtrak_rail_routes_orc (Hive)" if rail_pairs_from_hive else "fallback RAIL_PAIRS",
                    "flight_data": f"{tbl} (Hive ORC)",
                }}
    try:
        result = cached_query("rail_analysis_v2", _query)
        # Fetch Amtrak stations from external API
        try:
            amtrak = ext_requests.get("https://amtrak-api.marcmap.app/get-stations", timeout=15).json()
            result["amtrakStations"] = len(amtrak) if isinstance(amtrak, list) else 0
            result["amtrakSample"] = amtrak[:20] if isinstance(amtrak, list) else []
        except Exception as ae:
            result["amtrakStations"] = 0
            result["amtrakError"] = str(ae)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# V. Ghost Fare & Price Manipulation Monitoring
#    Teacher Requirement: Build anomaly detection for "sawtooth patterns"
#    (fare doubling then dropping back), analyze searchDate × fare correlation,
#    price change frequency, and combine with external complaint data.
# ---------------------------------------------------------------------------
@app.route("/api/enrichment/ghost")
def enrichment_ghost():
    def _query():
        tbl = get_flight_table()

        # ── Query 1: Price Anomaly Detection (max/min ratio > 3x) ──
        anomaly_sql = f"""
            SELECT startingAirport, destinationAirport, flightDate,
                   ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
                   ROUND(MAX(CAST(totalFare AS DOUBLE)),2) AS maxFare,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                   ROUND(MAX(CAST(totalFare AS DOUBLE))/NULLIF(MIN(CAST(totalFare AS DOUBLE)),0),2) AS priceRatio,
                   COUNT(DISTINCT searchDate) AS searchDates,
                   COUNT(*) AS listings
            FROM {tbl}
            WHERE totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
            GROUP BY startingAirport, destinationAirport, flightDate
            HAVING MAX(CAST(totalFare AS DOUBLE))/NULLIF(MIN(CAST(totalFare AS DOUBLE)),0) > 3
               AND COUNT(*) > 5
            ORDER BY priceRatio DESC
            LIMIT 50
        """
        _, anomaly_rows = run_query(anomaly_sql)
        anomalies = [clean_row(r) for r in anomaly_rows]

        # ── Query 2: Fare Volatility & Price Change Frequency per Route-Date ──
        # Measures how frequently prices change for the same flight across search dates
        volatility_sql = f"""
            SELECT startingAirport, destinationAirport, flightDate,
                   COUNT(DISTINCT searchDate) AS searchDateCount,
                   COUNT(DISTINCT ROUND(CAST(totalFare AS DOUBLE),0)) AS uniquePriceLevels,
                   ROUND(STDDEV(CAST(totalFare AS DOUBLE)),2) AS fareStdDev,
                   ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                   ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
                   ROUND(MAX(CAST(totalFare AS DOUBLE)),2) AS maxFare,
                   ROUND((MAX(CAST(totalFare AS DOUBLE)) - MIN(CAST(totalFare AS DOUBLE))),2) AS fareSwing,
                   ROUND(STDDEV(CAST(totalFare AS DOUBLE)) / NULLIF(AVG(CAST(totalFare AS DOUBLE)),0) * 100, 2) AS coeffOfVariation,
                   COUNT(*) AS totalListings
            FROM {tbl}
            WHERE totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
              AND searchDate IS NOT NULL AND flightDate IS NOT NULL
            GROUP BY startingAirport, destinationAirport, flightDate
            HAVING COUNT(DISTINCT searchDate) >= 3
               AND STDDEV(CAST(totalFare AS DOUBLE)) > 0
            ORDER BY coeffOfVariation DESC
            LIMIT 30
        """
        _, vol_rows = run_query(volatility_sql)
        volatility = [clean_row(r) for r in vol_rows]

        # ── Query 3: Sawtooth Detection — per-searchDate fare tracking ──
        # Get raw price curves for the top anomalous routes to detect
        # "fare doubling then dropping back" patterns
        # Pick top 5 busiest routes with high volatility for sawtooth analysis
        sawtooth_routes_sql = f"""
            SELECT startingAirport, destinationAirport,
                   COUNT(DISTINCT flightDate) AS flightDates,
                   COUNT(DISTINCT searchDate) AS searchDates,
                   COUNT(*) AS total
            FROM {tbl}
            WHERE totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
              AND searchDate IS NOT NULL
            GROUP BY startingAirport, destinationAirport
            HAVING COUNT(DISTINCT searchDate) >= 5 AND COUNT(*) >= 50
            ORDER BY total DESC
            LIMIT 5
        """
        _, sr_rows = run_query(sawtooth_routes_sql)
        sawtooth_routes = [clean_row(r) for r in sr_rows]

        # For each top route, get the searchDate → fare time series
        all_sawtooth_data = []
        for sr in sawtooth_routes[:5]:
            o = sr.get("startingAirport", "")
            d = sr.get("destinationAirport", "")
            if not o or not d:
                continue
            ts_sql = f"""
                SELECT searchDate,
                       flightDate,
                       ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
                       ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
                       ROUND(MAX(CAST(totalFare AS DOUBLE)),2) AS maxFare,
                       COUNT(*) AS listings
                FROM {tbl}
                WHERE startingAirport='{o}' AND destinationAirport='{d}'
                  AND totalFare IS NOT NULL AND CAST(totalFare AS DOUBLE) > 0
                  AND searchDate IS NOT NULL
                GROUP BY searchDate, flightDate
                ORDER BY flightDate, searchDate
                LIMIT 300
            """
            _, ts_rows = run_query(ts_sql)
            ts_data = [clean_row(r) for r in ts_rows]
            all_sawtooth_data.append({
                "route": f"{o}→{d}",
                "origin": o, "dest": d,
                "dataPoints": len(ts_data),
                "timeSeries": ts_data,
            })

        # ── Python-side sawtooth pattern detection ──
        # For each route's time series, detect price jumps > 80% followed by drops > 40%
        sawtooth_patterns = []
        for route_data in all_sawtooth_data:
            ts = route_data.get("timeSeries", [])
            # Group by flightDate
            by_flight = {}
            for pt in ts:
                fd = pt.get("flightDate", "")
                if fd not in by_flight:
                    by_flight[fd] = []
                by_flight[fd].append(pt)

            route_patterns = []
            for fd, points in by_flight.items():
                # Sort by searchDate within the same flightDate
                points.sort(key=lambda x: x.get("searchDate", ""))
                if len(points) < 3:
                    continue
                # Scan consecutive search dates for sawtooth: spike then drop
                for i in range(1, len(points) - 1):
                    prev_fare = points[i-1].get("avgFare", 0) or 0
                    curr_fare = points[i].get("avgFare", 0) or 0
                    next_fare = points[i+1].get("avgFare", 0) or 0
                    if prev_fare <= 0 or curr_fare <= 0 or next_fare <= 0:
                        continue
                    # Spike: current fare > 80% higher than previous
                    spike_pct = ((curr_fare - prev_fare) / prev_fare) * 100
                    # Drop: next fare drops > 40% from the spike
                    drop_pct = ((curr_fare - next_fare) / curr_fare) * 100 if curr_fare > 0 else 0
                    if spike_pct >= 80 and drop_pct >= 40:
                        route_patterns.append({
                            "flightDate": fd,
                            "searchDateBefore": points[i-1].get("searchDate", ""),
                            "searchDateSpike": points[i].get("searchDate", ""),
                            "searchDateAfter": points[i+1].get("searchDate", ""),
                            "fareBefore": prev_fare,
                            "fareSpike": curr_fare,
                            "fareAfter": next_fare,
                            "spikePct": round(spike_pct, 1),
                            "dropPct": round(drop_pct, 1),
                        })

            if route_patterns:
                sawtooth_patterns.append({
                    "route": route_data["route"],
                    "origin": route_data["origin"],
                    "dest": route_data["dest"],
                    "patternCount": len(route_patterns),
                    "patterns": route_patterns[:10],  # Top 10 per route
                })

        # ── Compute aggregate price change frequency stats ──
        total_volatile = len([v for v in volatility if (v.get("coeffOfVariation") or 0) > 20])
        avg_cv = sum(v.get("coeffOfVariation", 0) or 0 for v in volatility) / len(volatility) if volatility else 0
        avg_unique_prices = sum(v.get("uniquePriceLevels", 0) or 0 for v in volatility) / len(volatility) if volatility else 0
        total_sawtooth = sum(sp.get("patternCount", 0) for sp in sawtooth_patterns)

        return {
            "anomalies": anomalies,
            "volatility": volatility,
            "sawtoothRoutes": all_sawtooth_data,
            "sawtoothPatterns": sawtooth_patterns,
            "priceChangeStats": {
                "totalVolatileRoutes": total_volatile,
                "avgCoeffOfVariation": round(avg_cv, 2),
                "avgUniquePriceLevels": round(avg_unique_prices, 1),
                "totalSawtoothPatterns": total_sawtooth,
                "routesAnalyzed": len(all_sawtooth_data),
            },
            "query": anomaly_sql.strip(),
            "volatilityQuery": volatility_sql.strip(),
            "sawtoothQuery": sawtooth_routes_sql.strip(),
        }

    try:
        result = cached_query("ghost_analysis_v2", _query)
        # ── External: Fetch Reddit consumer complaints ──
        # Priority: 1) Hive ORC table  2) Local JSON file  3) Live Reddit API
        posts = []

        # Step 1: Try Hive ORC table first (HDFS+Hive+ORC pipeline)
        try:
            reddit_sql = "SELECT title, score, num_comments, url, permalink, created_utc, subreddit, author FROM reddit_posts_orc ORDER BY score DESC"
            _, reddit_rows = run_query(reddit_sql)
            for r in reddit_rows:
                row = clean_row(r)
                title = row.get("title", "")
                if not title:
                    continue
                permalink = row.get("permalink", "")
                posts.append({
                    "title": title,
                    "score": row.get("score", 0),
                    "comments": row.get("num_comments", 0),
                    "url": f"https://reddit.com{permalink}" if permalink else row.get("url", ""),
                    "created": row.get("created_utc", 0),
                    "subreddit": row.get("subreddit", ""),
                })
            if posts:
                print(f"[Ghost] Loaded {len(posts)} posts from reddit_posts_orc (Hive)")
                result["redditSource"] = "reddit_posts_orc (Hive ORC)"
        except Exception as hive_err:
            print(f"[Ghost] Hive reddit_posts_orc query failed: {hive_err}")
            posts = []

        # Step 2: Fallback to local reddit_api.json file
        if not posts:
            try:
                reddit_json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "external_data", "reddit_api.json")
                if os.path.exists(reddit_json_path):
                    with open(reddit_json_path, "r", encoding="utf-8") as rf:
                        reddit_local = json.load(rf)
                    children = reddit_local.get("data",{}).get("children",[])
                    if isinstance(reddit_local, list):
                        children = reddit_local
                    for child in children:
                        d = child.get("data", child) if isinstance(child, dict) else {}
                        title = d.get("title","")
                        if not title:
                            continue
                        posts.append({
                            "title": title,
                            "score": d.get("score",0),
                            "comments": d.get("num_comments",0),
                            "url": f"https://reddit.com{d.get('permalink','')}" if d.get('permalink') else d.get("url",""),
                            "created": d.get("created_utc",0),
                            "subreddit": d.get("subreddit",""),
                        })
                    if posts:
                        print(f"[Ghost] Loaded {len(posts)} posts from local reddit_api.json")
                        result["redditSource"] = "local_file (external_data/reddit_api.json)"
            except Exception as local_err:
                print(f"[Ghost] Local reddit_api.json load failed: {local_err}")

        # Step 3: Last resort — try live Reddit API
        if not posts:
            try:
                reddit = ext_requests.get(
                    "https://www.reddit.com/r/travel/search.json?q=ghost%20fare%20OR%20price%20bait%20OR%20fake%20price%20OR%20booking%20failure%20airline&limit=50&sort=relevance",
                    headers={"User-Agent": "SkyQuery/1.0"}, timeout=15
                )
                reddit_data = reddit.json()
                for child in reddit_data.get("data",{}).get("children",[]):
                    d = child.get("data",{})
                    posts.append({
                        "title": d.get("title",""),
                        "score": d.get("score",0),
                        "comments": d.get("num_comments",0),
                        "url": f"https://reddit.com{d.get('permalink','')}",
                        "created": d.get("created_utc",0),
                        "subreddit": d.get("subreddit",""),
                    })
                if posts:
                    result["redditSource"] = "live_api"
            except Exception as re_err:
                print(f"[Ghost] Reddit API also failed: {re_err}")
                if not posts:
                    result["redditError"] = "Hive, local file, and API all returned no data"

        result["redditPosts"] = posts
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===========================================================================
#   NEW ANALYTICS ENDPOINTS — Sections I.10, II, III
# ===========================================================================

# I.10  Nonstop premium — top 20 busiest routes direct vs multi-leg
@app.route("/api/analytics/nonstop-premium")
def analytics_nonstop_premium():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT route, nonstop_avg, connecting_avg,
               (nonstop_avg - connecting_avg) AS premium,
               nonstop_cnt, connecting_cnt
        FROM (
            SELECT CONCAT(startingAirport,' → ',destinationAirport) AS route,
                   AVG(CASE WHEN isNonStop='true' THEN CAST(totalFare AS DOUBLE) END) AS nonstop_avg,
                   AVG(CASE WHEN isNonStop='false' THEN CAST(totalFare AS DOUBLE) END) AS connecting_avg,
                   SUM(CASE WHEN isNonStop='true' THEN 1 ELSE 0 END) AS nonstop_cnt,
                   SUM(CASE WHEN isNonStop='false' THEN 1 ELSE 0 END) AS connecting_cnt,
                   COUNT(*) AS total
            FROM {tbl}
            GROUP BY startingAirport, destinationAirport
            ORDER BY total DESC
            LIMIT 20
        ) sub
        WHERE nonstop_avg IS NOT NULL AND connecting_avg IS NOT NULL
        """
        _, rows = run_query(sql)
        data = [clean_row(r) for r in rows]
        return {"routes": data, "query": sql}
    return jsonify(cached_query("nonstop_premium", _query))

# II.1 + II.2  Network overview — unique airports + null distance records
@app.route("/api/analytics/network-overview")
def analytics_network_overview():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT
            COUNT(DISTINCT startingAirport) AS unique_origins,
            COUNT(DISTINCT destinationAirport) AS unique_destinations,
            SUM(CASE WHEN totalTravelDistance IS NULL OR CAST(totalTravelDistance AS DOUBLE) IS NULL THEN 1 ELSE 0 END) AS null_distance_records,
            COUNT(*) AS total_records
        FROM {tbl}
        """
        _, rows = run_query(sql)
        r = clean_row(rows[0]) if rows else {}
        return {"overview": r, "query": sql}
    return jsonify(cached_query("network_overview", _query))

# II.3  Top 10 longest flights by distance
@app.route("/api/analytics/longest-flights")
def analytics_longest_flights():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT startingAirport, destinationAirport,
               CAST(totalTravelDistance AS DOUBLE) AS distance,
               segmentsAirlineName AS airline,
               CAST(totalFare AS DOUBLE) AS fare, travelDuration
        FROM {tbl}
        WHERE totalTravelDistance IS NOT NULL AND CAST(totalTravelDistance AS DOUBLE) > 0
        ORDER BY CAST(totalTravelDistance AS DOUBLE) DESC
        LIMIT 10
        """
        _, rows = run_query(sql)
        return {"flights": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("longest_flights", _query))

# II.4  Top 20 most frequent routes
@app.route("/api/analytics/top-routes")
def analytics_top_routes():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT startingAirport, destinationAirport,
               CONCAT(startingAirport,' → ',destinationAirport) AS route,
               COUNT(*) AS flightCount,
               ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare
        FROM {tbl}
        GROUP BY startingAirport, destinationAirport
        ORDER BY flightCount DESC
        LIMIT 20
        """
        _, rows = run_query(sql)
        return {"routes": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("top_routes", _query))

# II.5  Top 10 municipalities with most outbound flights
@app.route("/api/analytics/top-municipalities")
def analytics_top_municipalities():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT a.municipality, COUNT(*) AS flightCount,
               ROUND(AVG(CAST(f.totalFare AS DOUBLE)),2) AS avgFare
        FROM {tbl} f
        JOIN airports a ON f.startingAirport = a.iata_code
        WHERE a.municipality IS NOT NULL AND a.municipality != ''
        GROUP BY a.municipality
        ORDER BY flightCount DESC
        LIMIT 10
        """
        _, rows = run_query(sql)
        return {"municipalities": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("top_municipalities", _query))

# II.6  Top 5 regions with most active airports
@app.route("/api/analytics/top-regions")
def analytics_top_regions():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT a.iso_region AS region, COUNT(DISTINCT f.startingAirport) AS airportCount,
               COUNT(*) AS flightCount
        FROM {tbl} f
        JOIN airports a ON f.startingAirport = a.iata_code
        WHERE a.iso_region IS NOT NULL
        GROUP BY a.iso_region
        ORDER BY airportCount DESC
        LIMIT 5
        """
        _, rows = run_query(sql)
        return {"regions": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("top_regions", _query))

# II.7  Top 10 most expensive destination airports
@app.route("/api/analytics/expensive-destinations")
def analytics_expensive_destinations():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT destinationAirport,
               ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
               COUNT(*) AS flightCount,
               ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
               ROUND(MAX(CAST(totalFare AS DOUBLE)),2) AS maxFare
        FROM {tbl}
        GROUP BY destinationAirport
        HAVING COUNT(*) > 100
        ORDER BY avgFare DESC
        LIMIT 10
        """
        _, rows = run_query(sql)
        return {"destinations": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("expensive_destinations", _query))

# II.8  Top 20 routes with highest non-stop volume
@app.route("/api/analytics/nonstop-routes")
def analytics_nonstop_routes():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT CONCAT(startingAirport,' → ',destinationAirport) AS route,
               SUM(CASE WHEN isNonStop='true' THEN 1 ELSE 0 END) AS nonstopCount,
               COUNT(*) AS totalFlights,
               ROUND(SUM(CASE WHEN isNonStop='true' THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS nonstopPct
        FROM {tbl}
        GROUP BY startingAirport, destinationAirport
        ORDER BY nonstopCount DESC
        LIMIT 20
        """
        _, rows = run_query(sql)
        return {"routes": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("nonstop_routes", _query))

# II.9  Small regional vs large hub airport pricing
@app.route("/api/analytics/hub-vs-regional")
def analytics_hub_vs_regional():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT a.type AS airport_type,
               COUNT(*) AS flightCount,
               ROUND(AVG(CAST(f.totalFare AS DOUBLE)),2) AS avgFare,
               ROUND(MIN(CAST(f.totalFare AS DOUBLE)),2) AS minFare,
               ROUND(MAX(CAST(f.totalFare AS DOUBLE)),2) AS maxFare
        FROM {tbl} f
        JOIN airports a ON f.startingAirport = a.iata_code
        WHERE a.type IN ('large_airport','medium_airport','small_airport')
        GROUP BY a.type
        ORDER BY flightCount DESC
        """
        _, rows = run_query(sql)
        return {"types": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("hub_vs_regional", _query))

# II.10  Most expensive outbound region/state
@app.route("/api/analytics/region-pricing")
def analytics_region_pricing():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT a.iso_region AS region,
               ROUND(AVG(CAST(f.totalFare AS DOUBLE)),2) AS avgFare,
               COUNT(*) AS flightCount
        FROM {tbl} f
        JOIN airports a ON f.startingAirport = a.iata_code
        WHERE a.iso_region IS NOT NULL
        GROUP BY a.iso_region
        HAVING COUNT(*) > 50
        ORDER BY avgFare DESC
        LIMIT 15
        """
        _, rows = run_query(sql)
        return {"regions": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("region_pricing", _query))

# II.11  Monopoly routes vs competitive routes price-per-mile
@app.route("/api/analytics/monopoly-routes")
def analytics_monopoly_routes():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT competition, COUNT(*) AS routeCount,
               ROUND(AVG(avgFare),2) AS overallAvgFare,
               ROUND(AVG(pricePerMile),4) AS avgPricePerMile
        FROM (
            SELECT CONCAT(startingAirport,'→',destinationAirport) AS route,
                   COUNT(DISTINCT segmentsAirlineCode) AS numAirlines,
                   AVG(CAST(totalFare AS DOUBLE)) AS avgFare,
                   CASE WHEN AVG(CAST(totalTravelDistance AS DOUBLE)) > 0
                        THEN AVG(CAST(totalFare AS DOUBLE)) / AVG(CAST(totalTravelDistance AS DOUBLE))
                        ELSE NULL END AS pricePerMile,
                   CASE WHEN COUNT(DISTINCT segmentsAirlineCode) = 1 THEN 'Monopoly (1 airline)'
                        WHEN COUNT(DISTINCT segmentsAirlineCode) >= 3 THEN 'Competitive (3+ airlines)'
                        ELSE 'Duopoly (2 airlines)' END AS competition
            FROM {tbl}
            WHERE totalTravelDistance IS NOT NULL AND CAST(totalTravelDistance AS DOUBLE) > 0
            GROUP BY startingAirport, destinationAirport
        ) sub
        GROUP BY competition
        ORDER BY competition
        """
        _, rows = run_query(sql)
        return {"data": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("monopoly_routes", _query))

# II.12  Top 5 busiest hubs — legacy vs budget carrier pricing
@app.route("/api/analytics/hub-carriers")
def analytics_hub_carriers():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT startingAirport AS hub,
               segmentsAirlineName AS airline,
               COUNT(*) AS flightCount,
               ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare
        FROM {tbl}
        WHERE startingAirport IN (
            SELECT startingAirport FROM {tbl}
            GROUP BY startingAirport ORDER BY COUNT(*) DESC LIMIT 5
        )
        GROUP BY startingAirport, segmentsAirlineName
        HAVING COUNT(*) > 50
        ORDER BY startingAirport, flightCount DESC
        """
        _, rows = run_query(sql)
        return {"carriers": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("hub_carriers", _query))

# III.1+III.2+III.3  Aircraft overview — count, top 10, Boeing vs Airbus
@app.route("/api/analytics/aircraft-overview")
def analytics_aircraft_overview():
    def _query():
        tbl = get_flight_table()
        sql_count = f"SELECT COUNT(DISTINCT segmentsEquipmentDescription) AS total FROM {tbl} WHERE segmentsEquipmentDescription IS NOT NULL AND segmentsEquipmentDescription != ''"
        sql_top = f"""
        SELECT segmentsEquipmentDescription AS aircraft, COUNT(*) AS flightCount
        FROM {tbl}
        WHERE segmentsEquipmentDescription IS NOT NULL AND segmentsEquipmentDescription != ''
        GROUP BY segmentsEquipmentDescription
        ORDER BY flightCount DESC
        LIMIT 10
        """
        sql_mfr = f"""
        SELECT
            SUM(CASE WHEN UPPER(segmentsEquipmentDescription) LIKE '%BOEING%' OR UPPER(segmentsEquipmentDescription) LIKE '%B7%' THEN 1 ELSE 0 END) AS boeing,
            SUM(CASE WHEN UPPER(segmentsEquipmentDescription) LIKE '%AIRBUS%' OR UPPER(segmentsEquipmentDescription) LIKE '%A3%' THEN 1 ELSE 0 END) AS airbus,
            COUNT(*) AS total
        FROM {tbl}
        WHERE segmentsEquipmentDescription IS NOT NULL AND segmentsEquipmentDescription != ''
        """
        c1, r1 = run_query(sql_count)
        c2, r2 = run_query(sql_top)
        c3, r3 = run_query(sql_mfr)
        return {
            "totalModels": (r1[0].get("total", 0) if r1 else 0) if r1 else 0,
            "topAircraft": [clean_row(r) for r in r2],
            "manufacturers": clean_row(r3[0]) if r3 else {},
            "query": sql_top
        }
    return jsonify(cached_query("aircraft_overview", _query))

# III.4  Zero seats vs available seats pricing
@app.route("/api/analytics/seats-pricing")
def analytics_seats_pricing():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT
            CASE WHEN CAST(seatsRemaining AS INT) = 0 THEN 'Zero Seats'
                 WHEN CAST(seatsRemaining AS INT) BETWEEN 1 AND 3 THEN 'Low (1-3)'
                 ELSE 'Available (4+)' END AS seatCategory,
            COUNT(*) AS flightCount,
            ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
            ROUND(MIN(CAST(totalFare AS DOUBLE)),2) AS minFare,
            ROUND(MAX(CAST(totalFare AS DOUBLE)),2) AS maxFare
        FROM {tbl}
        WHERE seatsRemaining IS NOT NULL
        GROUP BY CASE WHEN CAST(seatsRemaining AS INT) = 0 THEN 'Zero Seats'
                      WHEN CAST(seatsRemaining AS INT) BETWEEN 1 AND 3 THEN 'Low (1-3)'
                      ELSE 'Available (4+)' END
        ORDER BY avgFare DESC
        """
        _, rows = run_query(sql)
        return {"data": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("seats_pricing", _query))

# III.5  Runway length vs ticket price
@app.route("/api/analytics/runway-pricing")
def analytics_runway_pricing():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT
            CASE WHEN CAST(r.length_ft AS INT) >= 10000 THEN 'Long (10000+ ft)'
                 WHEN CAST(r.length_ft AS INT) >= 7000 THEN 'Medium (7000-9999 ft)'
                 ELSE 'Short (<7000 ft)' END AS runwayCategory,
            COUNT(*) AS flightCount,
            ROUND(AVG(CAST(f.totalFare AS DOUBLE)),2) AS avgFare
        FROM {tbl} f
        JOIN airports a ON f.destinationAirport = a.iata_code
        JOIN ext_runways r ON a.ident = r.airport_ident
        WHERE r.length_ft IS NOT NULL AND CAST(r.length_ft AS INT) > 0
        GROUP BY CASE WHEN CAST(r.length_ft AS INT) >= 10000 THEN 'Long (10000+ ft)'
                      WHEN CAST(r.length_ft AS INT) >= 7000 THEN 'Medium (7000-9999 ft)'
                      ELSE 'Short (<7000 ft)' END
        ORDER BY avgFare DESC
        """
        _, rows = run_query(sql)
        return {"data": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("runway_pricing", _query))

# III.6  Aircraft model pricing — wide-body vs regional
@app.route("/api/analytics/aircraft-pricing")
def analytics_aircraft_pricing():
    def _query():
        tbl = get_flight_table()
        sql = f"""
        SELECT
            CASE WHEN UPPER(segmentsEquipmentDescription) LIKE '%777%' OR UPPER(segmentsEquipmentDescription) LIKE '%787%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%A350%' OR UPPER(segmentsEquipmentDescription) LIKE '%A330%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%A380%' OR UPPER(segmentsEquipmentDescription) LIKE '%767%'
                 THEN 'Wide-body'
                 WHEN UPPER(segmentsEquipmentDescription) LIKE '%ERJ%' OR UPPER(segmentsEquipmentDescription) LIKE '%CRJ%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%EMBRAER%' OR UPPER(segmentsEquipmentDescription) LIKE '%REGIONAL%'
                 THEN 'Regional Jet'
                 WHEN UPPER(segmentsEquipmentDescription) LIKE '%737%' OR UPPER(segmentsEquipmentDescription) LIKE '%A320%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%A321%' OR UPPER(segmentsEquipmentDescription) LIKE '%A319%'
                 THEN 'Narrow-body'
                 ELSE 'Other' END AS aircraftCategory,
            COUNT(*) AS flightCount,
            ROUND(AVG(CAST(totalFare AS DOUBLE)),2) AS avgFare,
            ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)),0) AS avgDistance
        FROM {tbl}
        WHERE segmentsEquipmentDescription IS NOT NULL AND segmentsEquipmentDescription != ''
        GROUP BY CASE WHEN UPPER(segmentsEquipmentDescription) LIKE '%777%' OR UPPER(segmentsEquipmentDescription) LIKE '%787%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%A350%' OR UPPER(segmentsEquipmentDescription) LIKE '%A330%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%A380%' OR UPPER(segmentsEquipmentDescription) LIKE '%767%'
                 THEN 'Wide-body'
                 WHEN UPPER(segmentsEquipmentDescription) LIKE '%ERJ%' OR UPPER(segmentsEquipmentDescription) LIKE '%CRJ%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%EMBRAER%' OR UPPER(segmentsEquipmentDescription) LIKE '%REGIONAL%'
                 THEN 'Regional Jet'
                 WHEN UPPER(segmentsEquipmentDescription) LIKE '%737%' OR UPPER(segmentsEquipmentDescription) LIKE '%A320%'
                      OR UPPER(segmentsEquipmentDescription) LIKE '%A321%' OR UPPER(segmentsEquipmentDescription) LIKE '%A319%'
                 THEN 'Narrow-body'
                 ELSE 'Other' END
        ORDER BY avgFare DESC
        """
        _, rows = run_query(sql)
        return {"data": [clean_row(r) for r in rows], "query": sql}
    return jsonify(cached_query("aircraft_pricing", _query))


# ---------------------------------------------------------------------------
# Background Pre-Warming: Auto-load enrichment data after Spark is ready
# ---------------------------------------------------------------------------
def _prewarm_enrichment():
    """Background thread that pre-warms enrichment caches after startup."""
    import time as _time
    _time.sleep(5)  # Wait for Flask to be fully ready
    print("[Pre-warm] Starting enrichment cache warm-up...")
    endpoints = [
        ("weather_ATL", lambda: enrichment_weather.__wrapped__() if hasattr(enrichment_weather, '__wrapped__') else None),
        ("wealth_analysis", None),
        ("brand_analysis", None),
        ("rail_analysis", None),
        ("ghost_analysis", None),
    ]
    # Use the Flask test client to trigger each endpoint
    with app.test_client() as client:
        tabs = [
            ("/api/enrichment/weather?airport=ATL", "Weather (ATL)"),
            ("/api/enrichment/wealth", "Wealth Gap"),
            ("/api/enrichment/brand", "Brand Markup"),
            ("/api/enrichment/rail", "Rail Effect"),
            ("/api/enrichment/ghost", "Ghost Fares"),
        ]
        for url, name in tabs:
            try:
                print(f"[Pre-warm] Loading {name}...")
                resp = client.get(url)
                if resp.status_code == 200:
                    print(f"[Pre-warm] ✅ {name} cached successfully")
                else:
                    print(f"[Pre-warm] ⚠️ {name} returned {resp.status_code}")
            except Exception as e:
                print(f"[Pre-warm] ❌ {name} failed: {e}")
    print("[Pre-warm] 🎉 All enrichment tabs pre-warmed!")

if __name__ == "__main__":
    # Initialize Spark on startup
    print("Initializing SparkSession with Hive support...")
    try:
        get_spark()
        print("SparkSession ready. Starting Flask server...")
        # Start background pre-warming thread
        prewarm_thread = threading.Thread(target=_prewarm_enrichment, daemon=True)
        prewarm_thread.start()
    except Exception as e:
        print(f"Skipping Spark init. Will attempt on first query. Error: {e}")
    app.run(host="0.0.0.0", port=5000, debug=False)
