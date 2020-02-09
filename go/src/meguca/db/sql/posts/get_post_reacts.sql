SELECT p.count, p.smile_name, p.post_id
FROM post_reacts p
WHERE post_id = $1
ORDER BY timestamp
