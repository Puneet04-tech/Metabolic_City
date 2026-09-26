const clients = new Set();

export function addStreamClient(response) {
  clients.add(response);
  response.on('close', () => clients.delete(response));
}

export function broadcastCells(cells) {
  const payload = `event: h3_update\ndata: ${JSON.stringify({ cells, emittedAt: new Date().toISOString() })}\n\n`;
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