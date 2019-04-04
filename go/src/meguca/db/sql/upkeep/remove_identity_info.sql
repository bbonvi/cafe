UPDATE posts SET ip = NULL
WHERE time < EXTRACT(EPOCH FROM now() - INTERVAL '30 days') and ip IS NOT NULL
