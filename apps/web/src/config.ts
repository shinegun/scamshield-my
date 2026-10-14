// The pipeline's call WebSocket. Set VITE_PIPELINE_URL at build time for deploys.
export const PIPELINE_URL: string = import.meta.env.VITE_PIPELINE_URL || 'ws://localhost:8080/call';
