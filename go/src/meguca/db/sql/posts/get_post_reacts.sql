SELECT p.count, smiles.name, smiles.file_hash, smiles.file_type, smiles.board, smiles.id, p.post_id
FROM post_reacts p
    INNER JOIN smiles on p.smile_id = smiles.id
WHERE post_id = $1
ORDER BY timestamp
