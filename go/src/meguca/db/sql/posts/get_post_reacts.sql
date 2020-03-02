SELECT p.count, smiles.name, p.post_id
FROM post_reacts p
    INNER JOIN smiles on p.smile_id = smiles.id
WHERE post_id = $1
ORDER BY timestamp
