select not exists (
    select from user_reacts
    INNER JOIN post_reacts ON user_reacts.post_react_id = post_reacts.id
    INNER JOIN smiles on post_reacts.smile_id = smiles.id
    where
        user_reacts.account_id = $1
        and
        (post_reacts.post_id = $2 and smiles.name = $3)
    limit 1
)
