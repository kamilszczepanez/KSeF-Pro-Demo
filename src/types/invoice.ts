export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}
