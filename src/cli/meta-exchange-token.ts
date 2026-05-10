import { loadLocalEnv } from "../config/env.js";
import { InstagramGraphClient } from "../meta/instagram-graph.js";

loadLocalEnv();

const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
const shortLivedUserToken = process.env.META_SHORT_LIVED_USER_TOKEN;

if (!appId || !appSecret || !shortLivedUserToken) {
  throw new Error("Set META_APP_ID, META_APP_SECRET, and META_SHORT_LIVED_USER_TOKEN");
}

const client = new InstagramGraphClient();
const result = await client.exchangeLongLivedUserToken({
  appId,
  appSecret,
  shortLivedUserToken
});

console.log(JSON.stringify(result, null, 2));
