select not exists(
  select from threads
  where id = $1
  and postctr >= 500
  and (extract(epoch from current_timestamp) - bumptime > 7 * 24 * 60 * 60)
)
