-- receipts.scanned_by can be null when the scan is triggered by a service
-- account or automated test rather than a specific user session.
alter table receipts alter column scanned_by drop not null;
