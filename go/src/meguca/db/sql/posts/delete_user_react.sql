DELETE FROM user_reacts
where account_id = $1 and post_react_id = $2
