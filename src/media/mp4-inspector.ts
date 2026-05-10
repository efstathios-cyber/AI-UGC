import { readFileSync } from "node:fs";

export function hasMp4AudioTrack(filePath: string): boolean {
  return mp4TrackTypes(filePath).includes("soun");
}

export function hasMp4VideoTrack(filePath: string): boolean {
  return mp4TrackTypes(filePath).includes("vide");
}

export function mp4TrackTypes(filePath: string): string[] {
  const buffer = readFileSync(filePath);
  const types: string[] = [];
  collectTrackTypesInRange(buffer, 0, buffer.length, types);
  return types;
}

function collectTrackTypesInRange(
  buffer: Buffer,
  start: number,
  end: number,
  types: string[]
): void {
  let offset = start;

  while (offset + 8 <= end) {
    const size32 = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    let boxSize = size32;

    if (size32 === 1) {
      if (offset + 16 > end) return;
      const largeSize = buffer.readBigUInt64BE(offset + 8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return;
      boxSize = Number(largeSize);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset;
    }

    if (boxSize < headerSize || offset + boxSize > end) {
      offset += 1;
      continue;
    }

    const contentStart = offset + headerSize;
    const contentEnd = offset + boxSize;
    const handler = type === "hdlr" ? handlerType(buffer, contentStart, contentEnd) : undefined;

    if (handler === "soun" || handler === "vide") {
      types.push(handler);
    }

    if (isContainerBox(type)) {
      collectTrackTypesInRange(buffer, contentStart, contentEnd, types);
    }

    offset += boxSize;
  }
}

function handlerType(buffer: Buffer, start: number, end: number): string | undefined {
  // hdlr is a full box: version/flags at bytes 0-3, pre_defined at 4-7,
  // handler_type at 8-11.
  if (start + 12 > end) return undefined;
  return buffer.toString("ascii", start + 8, start + 12);
}

function isContainerBox(type: string): boolean {
  return [
    "moov",
    "trak",
    "mdia",
    "minf",
    "stbl",
    "edts",
    "meta",
    "udta"
  ].includes(type);
}
