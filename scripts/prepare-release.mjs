import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
);
const applications = {
  admin: "/v1/admin/server/list",
  user: "/v1/public/subscribe/list",
};

for (const prefix of ["", "/api"]) {
  execFileSync("bun", ["run", "build"], {
    cwd: root,
    env: { ...process.env, VITE_API_BASE_URL: "", VITE_API_PREFIX: prefix },
    stdio: "inherit",
  });

  for (const [app, route] of Object.entries(applications)) {
    const dist = join(root, "apps", app, "dist");
    const staticDir = join(dist, "static");
    const chunks = readdirSync(staticDir)
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(join(staticDir, name), "utf8"));
    const archive = join(root, `${app}${prefix ? "-with-api" : ""}.tar.gz`);
    if (
      !chunks.some(
        (chunk) =>
          chunk.includes(prefix ? `/api${route}` : route) &&
          (prefix || !chunk.includes(`/api${route}`))
      )
    ) {
      throw new Error(`${archive} API prefix does not match its variant`);
    }

    execFileSync("tar", ["-czf", archive, "-C", dist, "."]);
    const entries = execFileSync("tar", ["-tzf", archive], {
      encoding: "utf8",
    }).split(/\r?\n/);
    if (!entries.includes("./index.html")) {
      throw new Error(`${archive} entry is missing`);
    }
    if (
      !entries.some(
        (entry) => entry.startsWith("./static/") && entry.endsWith(".js")
      )
    ) {
      throw new Error(`${archive} JavaScript assets are missing`);
    }
    const lock = execFileSync("tar", ["-xOf", archive, "./version.lock"], {
      encoding: "utf8",
    });
    if (lock !== version) {
      throw new Error(`${archive} version does not match ${version}`);
    }
    console.log(`Verified ${app}${prefix ? " /api" : " default"} ${version}`);
  }
}
