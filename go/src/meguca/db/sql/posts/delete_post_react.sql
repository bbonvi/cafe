DELETE FROM post_reacts AS pr USING smiles AS s
WHERE
    pr.smile_id = s.id
    AND s.name = $2
    AND pr.post_id = $1
