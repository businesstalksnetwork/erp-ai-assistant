// ERP-AI Assistant Service Worker
// Push Notifications + POS Offline Support

const CACHE_NAME = 'erp-pos-v1';
const POS_ASSETS = [
  '/',
  '/favicon.png',
  '/manifest.json',
];

// ── Install: pre-cache POS-critical assets ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(POS_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback for navigations & POS assets ──
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // For navigations and cached assets: network-first, cache-fallback
  if (event.request.mode === 'navigate' || POS_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }
});

// ── IndexedDB Offline Transaction Queue for POS ──
const DB_NAME = 'erp-offline-queue';
const STORE_NAME = 'pending-transactions';

function openOfflineDB() {
  return new Promise(function(resolve, reject) {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

function addToQueue(transaction) {
  return openOfflineDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add({
        ...transaction,
        queued_at: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
}

function getAllQueued() {
  return openOfflineDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
}

function clearQueued(ids) {
  return openOfflineDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      ids.forEach(function(id) { store.delete(id); });
      tx.oncomplete = resolve;
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
}

// ── Sync on reconnect ──
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-pos-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  const queued = await getAllQueued();
  if (!queued.length) return;

  const synced = [];
  for (const item of queued) {
    try {
      const res = await fetch(item.url, {
        method: item.method || 'POST',
        headers: item.headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });
      if (res.ok) synced.push(item.id);
    } catch (_) {
      // Still offline, will retry on next sync
      break;
    }
  }

  if (synced.length) {
    await clearQueued(synced);
    // Notify clients about sync completion
    const allClients = await self.clients.matchAll();
    allClients.forEach(function(client) {
      client.postMessage({ type: 'POS_SYNC_COMPLETE', synced: synced.length, remaining: queued.length - synced.length });
    });
  }
}

// ── Listen for offline queue messages from POS terminal ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'QUEUE_POS_TRANSACTION') {
    event.waitUntil(
      addToQueue(event.data.transaction).then(function() {
        event.source.postMessage({ type: 'POS_QUEUED', id: event.data.transaction.id });
      })
    );
  }
  if (event.data && event.data.type === 'TRIGGER_SYNC') {
    event.waitUntil(syncPendingTransactions());
  }
});

// ── Push Notifications ──
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.message || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {
      url: data.link || '/'
    },
    tag: data.tag || 'erpai-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ERP-AI Assistant', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
