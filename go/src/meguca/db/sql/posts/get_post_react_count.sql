SELECT p.count
FROM post_reacts p
WHERE post_id = $1 and smile_name = $2
ORDER BY timestamp
