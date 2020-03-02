UPDATE post_reacts
SET count = $1
from smiles as s
where s.id = post_reacts.smile_id and post_id = $2 and s.name = $3
RETURNING post_reacts.id
