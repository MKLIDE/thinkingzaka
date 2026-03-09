// sw.js - Add to your existing service worker

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'market-update') {
        event.waitUntil(
            clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'REFRESH' });
                });
            })
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'UPDATE') {
        // Cache latest data
        self.lastUpdate = event.data.data;
    }
});
