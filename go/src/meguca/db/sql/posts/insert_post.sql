INSERT INTO posts (id, op, time, board, auth, name, body, ip, unique_id, links, commands)
VALUES            ($1, $2, $3,   $4,    $5,   $6,   $7,   $8, $9,        $10,   $11)
RETURNING bump_thread($2, true, false, true, $12)
