INSERT INTO post_reacts (post_id, smile_id, count)
VALUES            ($1, $2, 1)
RETURNING id
