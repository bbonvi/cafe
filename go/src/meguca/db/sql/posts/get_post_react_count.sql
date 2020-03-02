SELECT p.count
FROM post_reacts p
INNER JOIN smiles on p.smile_id = smiles.id
WHERE post_id = $1 and smiles.name = $2
ORDER BY timestamp
