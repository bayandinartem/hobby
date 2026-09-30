import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = process.cwd();
const contentTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
};

createServer(async (request, response) => {
	if (request.method !== "GET" && request.method !== "HEAD") {
		response.writeHead(405, { Allow: "GET, HEAD" });
		response.end();
		return;
	}

	let pathname;
	try {
		pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	} catch {
		response.writeHead(400);
		response.end("Bad request");
		return;
	}

	const filename = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
	if (!filename.startsWith(`${root}${sep}`)) {
		response.writeHead(403);
		response.end("Forbidden");
		return;
	}

	try {
		const file = await readFile(filename);
		response.writeHead(200, {
			"Content-Type": contentTypes[extname(filename)] ?? "application/octet-stream",
			"X-Content-Type-Options": "nosniff",
		});
		response.end(request.method === "HEAD" ? undefined : file);
	} catch (error) {
		if (error.code !== "ENOENT" && error.code !== "EISDIR") {
			response.writeHead(500);
			response.end("Internal server error");
			console.error("Failed to read requested file:", error);
			return;
		}
		response.writeHead(404);
		response.end("Not found");
	}
}).listen(8000, "127.0.0.1", () => {
	console.log("Косынка доступна по адресу http://localhost:8000");
});
