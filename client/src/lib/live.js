import { MOCK, subscribeMock } from './mock.js';

// Live updates: the real server pushes over Server-Sent Events; mock mode simulates the same events.
export function connectLive(onEvent, onStatus) {
  if (MOCK) {
    onStatus(true);
    return subscribeMock(onEvent);
  }
  const source = new EventSource('/api/events');
  source.onopen = () => onStatus(true);
  source.onerror = () => onStatus(false);
  source.onmessage = (e) => onEvent(JSON.parse(e.data));
  return () => source.close();
}
