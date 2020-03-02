SELECT DISTINCT
    count,
    smiles.name,
    smiles.board,
    smiles.file_hash,
    smiles.file_type,
    post_id,
    ($2 != '' and $2 is not null and $2 in (
        SELECT account_id from user_reacts as ur where ur.post_react_id = pr.id
    )) as self
FROM post_reacts AS pr
  INNER JOIN user_reacts AS ur ON ur.post_react_id = pr.id
  INNER JOIN posts AS p ON p.id = pr.post_id
  INNER JOIN smiles on pr.smile_id = smiles.id
WHERE p.op = $1
ORDER BY post_id;
