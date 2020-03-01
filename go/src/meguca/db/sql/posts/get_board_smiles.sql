select
    name, id, file_hash, board, file_type
from smiles
where board = $1
order by id DESC
