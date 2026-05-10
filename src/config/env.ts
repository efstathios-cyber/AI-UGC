import { existsSync, readFileSync } from "node:fs";

const envFiles = [".env.local", ".env", ".env.example"];

export function loadLocalEnv(): void {
  for (const file of envFiles) {
    if (!existsSync(file)) continue;

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = stripQuotes(rawValue);

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
