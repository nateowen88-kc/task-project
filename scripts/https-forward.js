import net from "node:net";

const listenPort = Number(process.env.HTTPS_FORWARD_PORT ?? 443);
const targetHost = process.env.HTTPS_FORWARD_TARGET_HOST ?? "127.0.0.1";
const targetPort = Number(process.env.HTTPS_FORWARD_TARGET_PORT ?? 5173);

const server = net.createServer((clientSocket) => {
  const targetSocket = net.connect(targetPort, targetHost);

  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);

  const closeBoth = () => {
    clientSocket.destroy();
    targetSocket.destroy();
  };

  clientSocket.on("error", closeBoth);
  targetSocket.on("error", closeBoth);
  clientSocket.on("close", closeBoth);
  targetSocket.on("close", closeBoth);
});

server.on("error", (error) => {
  console.error("HTTPS forwarder failed:", error);
  process.exit(1);
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(
    `HTTPS forwarder listening on 0.0.0.0:${listenPort} -> ${targetHost}:${targetPort}`,
  );
});
