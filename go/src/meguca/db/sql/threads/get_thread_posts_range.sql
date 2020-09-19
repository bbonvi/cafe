WITH t AS (
  SELECT p.id AS post_id, p.time, p.auth, a.id, a.name, p.body, p.links, p.commands, a.settings
  FROM posts p
  LEFT JOIN accounts a ON a.id = p.name
  WHERE op = $1 AND p.id != $1 AND p.id >= $2
  ORDER BY p.id ASC
  LIMIT $3
)
SELECT * FROM t ORDER BY post_id ASC
