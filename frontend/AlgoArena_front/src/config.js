const defaultProtocol = window.location.protocol === "https:" ? "https:" : "http:";
const defaultHost = window.location.hostname || "localhost";
const defaultPort = import.meta.env.VITE_BACKEND_PORT || "5001";

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || `${defaultProtocol}//${defaultHost}:${defaultPort}`;
