CREATE OR REPLACE FUNCTION mgl_private.invoice_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND
    (to_jsonb(NEW)-ARRAY[
      'status','pse_request_id','pse_response','cdr_url','cdr_code','accepted_at','last_error',
      'intifact_idempotency_hash','intifact_document_id','cdr_xml','pdf_url','provider_status',
      'sunat_pdf_url','sunat_xml_url','sunat_cdr_xml_url','sunat_error','cdr_hash',
      'last_sunat_check_at','sunat_sent_at',
      'sunat_xml','sunat_cdr_zip_base64','sunat_digest','sunat_response_description',
      'void_note_document_id','void_note_series','void_note_number','void_note_status',
      'updated_at','server_updated_at','mutation_id'
    ]) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY[
      'status','pse_request_id','pse_response','cdr_url','cdr_code','accepted_at','last_error',
      'intifact_idempotency_hash','intifact_document_id','cdr_xml','pdf_url','provider_status',
      'sunat_pdf_url','sunat_xml_url','sunat_cdr_xml_url','sunat_error','cdr_hash',
      'last_sunat_check_at','sunat_sent_at',
      'sunat_xml','sunat_cdr_zip_base64','sunat_digest','sunat_response_description',
      'void_note_document_id','void_note_series','void_note_number','void_note_status',
      'updated_at','server_updated_at','mutation_id'
    ]) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: issued fiscal data is immutable';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND NEW.status='draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: cannot reopen an emitted invoice';
  END IF;
  RETURN NEW;
END;
$function$;

