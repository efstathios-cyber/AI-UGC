import { loadLocalEnv } from "../config/env.js";
import { InstagramGraphClient } from "../meta/instagram-graph.js";

loadLocalEnv();

const accessToken = process.env.META_ACCESS_TOKEN ?? process.env.META_USER_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error("Set META_ACCESS_TOKEN or META_USER_ACCESS_TOKEN before running discovery");
}

const client = new InstagramGraphClient();
const result = await client.discoverInstagramAccounts(accessToken);
console.log(JSON.stringify(result, null, 2));
