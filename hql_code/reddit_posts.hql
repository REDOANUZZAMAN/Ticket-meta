-- ============================================================================
-- Reddit Consumer Complaints / Travel Posts (External Dataset)
-- Source: Reddit API - Manually extracted posts related to ghost fares,
--         price bait, booking failures, and airline complaints
-- File: external_data/reddit_api.json → flattened to CSV
-- ============================================================================
-- Step 1: Upload flattened CSV to HDFS
-- hdfs dfs -mkdir -p /user/hive/warehouse/ticketmeta09.db/reddit_posts
-- hdfs dfs -put reddit_posts.csv /user/hive/warehouse/ticketmeta09.db/reddit_posts/

USE ticketmeta09;

-- Step 2: Create external table pointing to CSV on HDFS
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
ROW FORMAT DELIMITED
FIELDS TERMINATED BY '\t'
STORED AS TEXTFILE
LOCATION '/user/hive/warehouse/ticketmeta09.db/reddit_posts'
TBLPROPERTIES ('skip.header.line.count'='1');

-- Step 3: Create optimized ORC table for faster queries
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
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- Step 4: Load data from external table into ORC
INSERT OVERWRITE TABLE reddit_posts_orc
SELECT * FROM ext_reddit_posts;

-- Step 5: Verify data
SELECT * FROM reddit_posts_orc LIMIT 10;
SELECT COUNT(*) AS total_posts FROM reddit_posts_orc;

-- ============================================================================
-- Example queries for ghost fare analysis:
-- ============================================================================
-- Top posts by score:
-- SELECT title, score, num_comments, subreddit
-- FROM reddit_posts_orc
-- ORDER BY score DESC
-- LIMIT 20;
--
-- Posts mentioning fare/price issues:
-- SELECT title, score, subreddit
-- FROM reddit_posts_orc
-- WHERE LOWER(title) LIKE '%fare%' OR LOWER(title) LIKE '%price%'
--    OR LOWER(title) LIKE '%ghost%' OR LOWER(title) LIKE '%bait%'
-- ORDER BY score DESC;
