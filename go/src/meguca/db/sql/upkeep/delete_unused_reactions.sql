DELETE FROM post_reacts AS pr USING smiles as s
WHERE s.name = $1 and s.id = pr.smile_id
