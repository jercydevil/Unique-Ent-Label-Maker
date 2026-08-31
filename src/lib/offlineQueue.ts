// src/lib/offlineQueue.ts
// IndexedDB storage and automatic background synchronization for deliveries

import Dexie, { type Table } from 'dexie';
import { callRpc } from './supabase';

export interface PendingDelivery {
  id?: number;
  client_tx_uuid: string;
  label_code: string;
  client_name: string;
  qty: number;
  occurred_at: string;
  device_id: string;
  is_sandbox: boolean;
  status: 'pending' | 'syncing' | 'failed';
  error_msg?: string;
  created_at: number;
}

class OfflineDatabase extends Dexie {
  pendingDeliveries!: Table<PendingDelivery, number>;

  constructor() {
    super('UniqueEntOfflineDB');
    this.version(1).stores({
      pendingDeliveries: '++id, client_tx_uuid, label_code, is_sandbox, status, created_at'
    });
  }
}

export const offlineDb = new OfflineDatabase();

// Add delivery to offline store
export async function queueOfflineDelivery(delivery: Omit<PendingDelivery, 'id' | 'status' | 'created_at'>): Promise<number> {
  const item: PendingDelivery = {
    ...delivery,
    status: 'pending',
    created_at: Date.now()
  };
  return await offlineDb.pendingDeliveries.add(item);
}

// Get count of unsynced items
export async function getPendingCount(): Promise<number> {
  return await offlineDb.pendingDeliveries.where('status').equals('pending').count();
}

// Get all pending deliveries
export async function getAllPending(): Promise<PendingDelivery[]> {
  return await offlineDb.pendingDeliveries.toArray();
}

// Background sync worker
export async function syncOfflineDeliveries(token?: string): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = await offlineDb.pendingDeliveries.where('status').equals('pending').toArray();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await offlineDb.pendingDeliveries.update(item.id!, { status: 'syncing' });

      const { data, error } = await callRpc(
        'record_delivery',
        {
          p_label_code: item.label_code,
          p_client_name: item.client_name,
          p_qty: item.qty,
          p_client_tx_uuid: item.client_tx_uuid,
          p_occurred_at: item.occurred_at,
          p_device_id: item.device_id,
          p_is_sandbox: item.is_sandbox
        },
        token
      );

      if (error) {
        await offlineDb.pendingDeliveries.update(item.id!, {
          status: 'failed',
          error_msg: error
        });
        failed++;
      } else {
        // Successfully synced to cloud
        await offlineDb.pendingDeliveries.delete(item.id!);
        synced++;
      }
    } catch (err: any) {
      await offlineDb.pendingDeliveries.update(item.id!, {
        status: 'failed',
        error_msg: err?.message || 'Sync error'
      });
      failed++;
    }
  }

  return { synced, failed };
}
