// src/lib/supabase.ts
// Direct Supabase API client and Edge Function connector

export const SUPABASE_URL = "https://foqcklcveratblxbhxvd.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_dJTRfnx8Y-RUQGWnN_asRQ_ScRvkatA";

export interface UserSession {
  id: string;             // auth_user_id
  staff_id: string;       // core.staff.id
  staff_code: string;
  display_name: string;
  role: 'admin' | 'staff';
  token: string;
  expires_at: number;
}

export interface Product {
  id: string;
  size_mm: number;
  color: string;
  product_type: string | null;
  sku: string | null;
  label_heading: string;
  label_color_hex: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  active: boolean;
}

export interface Batch {
  id: string;
  batch_code: string;
  product_id: string;
  qty_per_label: number;
  label_count: number;
  label_heading: string;
  size_mm: number;
  color: string;
  creator_name: string;
  used_count: number;
  voided: boolean;
  created_at: string;
}

export interface Label {
  id: string;
  label_code: string;
  batch_id: string;
  product_id: string;
  status: 'unused' | 'used' | 'lost' | 'damaged' | 'void';
  status_reason?: string;
  printed_at?: string;
  created_at: string;
}

export interface LabelDetails {
  id: string;
  label_code: string;
  status: 'unused' | 'used' | 'lost' | 'damaged' | 'void';
  batch_id: string;
  product_id: string;
  label_heading: string;
  size_mm: number;
  color: string;
  sku?: string;
  qty_per_label: number;
  batch_code: string;
  source_schema?: 'core' | 'sandbox';
}

export interface Transaction {
  id: string;
  client_tx_uuid: string;
  label_id: string;
  label_code: string;
  product_id: string;
  product_type?: string;
  label_heading: string;
  size_mm: number;
  color: string;
  client_id: string;
  client_name: string;
  qty: number;
  staff_id: string;
  staff_name: string;
  device_id?: string;
  status: 'confirmed' | 'flagged' | 'voided';
  occurred_at: string;
  server_received_at: string;
}

// -------------------------------------------------------------
// Authentication API
// -------------------------------------------------------------

export async function loginWithPin(staff_code: string, pin: string): Promise<{ session?: UserSession; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_code, pin })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || 'Authentication failed' };
    }

    const session: UserSession = {
      id: data.user.id,
      staff_id: data.user.staff_id,
      staff_code: data.user.staff_code,
      display_name: data.user.display_name,
      role: data.user.role,
      token: data.access_token,
      expires_at: data.expires_at
    };

    return { session };
  } catch (err: any) {
    return { error: err?.message || 'Network error connecting to auth service' };
  }
}

// -------------------------------------------------------------
// Admin Staff Provisioning API
// -------------------------------------------------------------

export async function createStaffMember(
  token: string,
  staffData: { staff_code: string; display_name: string; role: 'admin' | 'staff'; pin: string }
): Promise<{ staff?: any; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(staffData)
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || 'Failed to create staff member' };
    }
    return { staff: data.staff };
  } catch (err: any) {
    return { error: err?.message || 'Network error' };
  }
}

// -------------------------------------------------------------
// Generic Authenticated RPC Invoker
// -------------------------------------------------------------

export async function callRpc<T = any>(
  fnName: string,
  params: Record<string, any> = {},
  token?: string
): Promise<{ data?: T; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      return { error: (data && data.message) || (data && data.error) || `Server error (${res.status})` };
    }

    return { data: data as T };
  } catch (err: any) {
    return { error: err?.message || 'Network error executing database query' };
  }
}
