SELECT count, smile_name, post_id FROM post_reacts AS pr
  INNER JOIN user_reacts AS ur ON ur.post_react_id = pr.id
  INNER JOIN posts AS p ON p.id = pr.post_id
WHERE ur.account_id = $1 AND p.op = $2
