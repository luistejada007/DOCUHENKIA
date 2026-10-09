const subscribers = new Set();

function subscribe(response) {
  subscribers.add(response);
  return () => subscribers.delete(response);
}

function publish(announcement) {
  const event = `event: announcement\ndata: ${JSON.stringify(announcement)}\n\n`;
  for (const response of subscribers) {
    if (response.destroyed || response.writableEnded) {
      subscribers.delete(response);
      continue;
    }
    response.write(event);
  }
}

module.exports = { subscribe, publish };