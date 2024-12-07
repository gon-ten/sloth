let lastId: string | undefined;

let ws: WebSocket;
let connected = false;

function connect() {
  ws = new WebSocket(`ws://${location.host}/__hot_reload`);

  ws.onopen = () => {
    connected = true;
    ws.send(JSON.stringify({ type: 'presence' }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'ack') {
        if (typeof lastId === 'string' && lastId !== data.payload.id) {
          location.reload();
        }
        lastId = data.payload.id;
      }
    } catch {
      // do nothing
    }
  };

  ws.onclose = ({ wasClean }) => {
    connected = false;
    if (!wasClean) {
      const interval = setTimeout(() => {
        if (connected) {
          clearInterval(interval);
          return;
        }
        connect();
      }, 1_000);
    }
  };
}

connect();
