select not exists (
    select from user_reacts
    INNER JOIN post_reacts ON user_reacts.post_react_id = post_reacts.id
    where
        (user_reacts.ip = $1 or user_reacts.account_id = $2)
        and
        (post_reacts.post_id = $3 and post_reacts.smile_name = $4)
    limit 1
)
