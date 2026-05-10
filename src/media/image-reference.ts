import { readFileSync } from "node:fs";
import path from "node:path";

export function isRemoteImageReference(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function imageReferenceToSeedDanceUrl(value: string): string {
  if (isRemoteImageReference(value)) {
    return value;
  }

  const ext = path.extname(value).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const bytes = readFileSync(value);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}
