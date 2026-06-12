DROP INDEX "transaction_references_type_value_uidx";--> statement-breakpoint
CREATE INDEX "transaction_references_value_idx" ON "transaction_references" USING btree ("value");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_references_transaction_id_type_value_uidx" ON "transaction_references" USING btree ("transaction_id","type","value");