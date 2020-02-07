SELECT post_reacts.count, post_reacts.smile_name, post_reacts.post_id
FROM post_reacts
INNER JOIN posts ON post_reacts.post_id=posts.id
WHERE posts.op = $1
