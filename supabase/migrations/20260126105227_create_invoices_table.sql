/*
  # Create invoices table for accounting dashboard

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key) - Unique identifier for each invoice
      - `invoice_number` (text) - Invoice number/reference
      - `vendor_name` (text) - Name of the vendor/supplier
      - `amount` (numeric) - Invoice amount
      - `issue_date` (date) - Date when invoice was issued
      - `due_date` (date) - Payment due date
      - `status` (text) - Invoice status: 'pending', 'approved', or 'rejected'
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `invoices` table
    - Add policies for authenticated users to:
      - View all invoices
      - Update invoice status (approve/reject)
      - Insert new invoices

  3. Notes
    - Default status is 'pending'
    - Amounts are stored with 2 decimal precision
    - Status can only be 'pending', 'approved', or 'rejected'
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  vendor_name text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice status"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON invoices(due_date);