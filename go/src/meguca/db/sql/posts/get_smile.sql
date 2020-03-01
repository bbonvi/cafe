select
    name, id, file_hash, board
from smiles
where board = $1 and name = $2
