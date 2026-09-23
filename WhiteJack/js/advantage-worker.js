import { estimateAdvantage } from './advantage.js';
self.onmessage = ({ data }) => {
  try { self.postMessage(estimateAdvantage(data)); }
  catch (error) { self.postMessage({ error: error.message }); }
};
