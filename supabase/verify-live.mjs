import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [
        line.slice(0, separator),
        line.slice(separator + 1).replace(/^['"]|['"]$/g, ""),
      ];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are missing");

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const checks = [
  [
    "user_lists",
    "/rest/v1/user_lists?select=id,owner_id,visibility,fetch_count&limit=1",
    {},
  ],
  [
    "list_fetches",
    "/rest/v1/list_fetches?select=list_id,user_id&limit=1",
    {},
  ],
  [
    "fetch_public_list RPC",
    "/rest/v1/rpc/fetch_public_list",
    {
      method: "POST",
      body: JSON.stringify({
        p_list_id: "00000000-0000-0000-0000-000000000000",
      }),
    },
  ],
  [
    "user_lists anonymous insert",
    "/rest/v1/user_lists",
    {
      method: "POST",
      body: JSON.stringify({
        owner_id: "00000000-0000-0000-0000-000000000000",
        title: "RLS verification probe",
        visibility: "public",
      }),
    },
  ],
  [
    "list_fetches anonymous insert",
    "/rest/v1/list_fetches",
    {
      method: "POST",
      body: JSON.stringify({
        list_id: "00000000-0000-0000-0000-000000000000",
        user_id: "00000000-0000-0000-0000-000000000000",
      }),
    },
  ],
];

for (const [name, path, options] of checks) {
  const response = await fetch(`${url}${path}`, { headers, ...options });
  const body = await response.json().catch(() => ({}));
  console.log(
    JSON.stringify({
      name,
      status: response.status,
      ok: response.ok,
      code: body?.code,
      message: body?.message,
      rows: Array.isArray(body) ? body.length : undefined,
    }),
  );
}
