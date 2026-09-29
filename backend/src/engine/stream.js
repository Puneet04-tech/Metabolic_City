const clients = new Set();
let heartbeatTimer = null;

function ensureHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (clients.size === 0) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      return;
    }
    const pingMessage = `: ping ${new Date().toISOString()}\n\n`;
    for (const client of clients) {
      try {
        client.write(pingMessage);
      } catch {
        clients.delete(client);
      }
    }
  }, 15000);
}

export function addStreamClient(response) {
  clients.add(response);
  ensureHeartbeat();

  response.on('close', () => {
    clients.delete(response);
    if (clients.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  response.on('error', () => {
    clients.delete(response);
  });
}

export function broadcastCells(cells) {
  if (!cells || !cells.length) return;
  const payload = `event: h3_update\ndata: ${JSON.stringify({ cells, emittedAt: new Date().toISOString() })}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastIncident(incident) {
  if (!incident) return;
  const payload = `event: incident_update\ndata: ${JSON.stringify({ incident, emittedAt: new Date().toISOString() })}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function streamClientCount() {
  return clients.size;
}
