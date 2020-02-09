UPDATE posts SET unique_id = NULL
WHERE time < EXTRACT(EPOCH FROM now() - INTERVAL '30 days') and unique_id IS NOT NULL
