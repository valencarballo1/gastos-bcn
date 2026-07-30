import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "out");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const server = resolve(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });
await cp(output, client, { recursive: true });

const worker = `const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && !url.pathname.includes(".")) {
      const pathname = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
      response = await env.ASSETS.fetch(new Request(new URL(pathname + "index.html", request.url), request));
    }

    if (response.status === 404) {
      response = await env.ASSETS.fetch(new Request(new URL("/404.html", request.url), request));
    }

    return response;
  },
};

export default worker;
`;

await writeFile(resolve(server, "index.js"), worker, "utf8");
