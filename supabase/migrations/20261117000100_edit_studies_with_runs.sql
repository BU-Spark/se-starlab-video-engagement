-- Studies stay editable after participants have run them, so researchers fix a study in place
-- instead of making copies. Only one thing stays blocked: removing a block that has participant
-- data (block_views.block_id is "on delete restrict" too; this gives a readable message).
--
-- Collected rows keep what the participant actually saw: block_views.stimulus is copied at run
-- time. The export's Block column is the block's current label.
create or replace function public.block_edits_after_runs() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and exists (select 1 from public.block_views where block_id = old.id) then
    raise exception 'Block "%" has participant data and cannot be removed.', old.label using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists blocks_locked_after_runs on public.blocks;
drop trigger if exists blocks_with_data_kept on public.blocks;
create trigger blocks_with_data_kept before delete on public.blocks
  for each row execute function public.block_edits_after_runs();
