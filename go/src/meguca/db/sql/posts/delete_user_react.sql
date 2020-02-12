DELETE FROM user_reacts
where ( account_id = $1 or ip = $2 ) and post_react_id = $3
