grant execute on function mgl_private.bootstrap_company(text,text,text) to authenticated;
grant execute on function mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) to authenticated;
grant execute on function mgl_private.transition_purchase_order(uuid,text) to authenticated;
grant execute on function mgl_private.queue_invoice(uuid,text) to authenticated;
