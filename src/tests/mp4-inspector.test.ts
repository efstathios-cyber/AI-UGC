import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { hasMp4AudioTrack, hasMp4VideoTrack, mp4TrackTypes } from "../media/mp4-inspector.js";

test("detects a simple MP4 audio handler marker", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mp4-inspector-"));
  const filePath = path.join(tempDir, "audio.mp4");
  await fs.writeFile(filePath, makeMp4WithHandler("soun"));

  assert.equal(hasMp4AudioTrack(filePath), true);
  assert.equal(hasMp4VideoTrack(filePath), false);
  assert.deepEqual(mp4TrackTypes(filePath), ["soun"]);
});

test("returns false when no audio handler marker exists", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mp4-inspector-"));
  const filePath = path.join(tempDir, "silent.mp4");
  await fs.writeFile(filePath, makeMp4WithHandler("vide"));

  assert.equal(hasMp4AudioTrack(filePath), false);
  assert.equal(hasMp4VideoTrack(filePath), true);
  assert.deepEqual(mp4TrackTypes(filePath), ["vide"]);
});

function makeMp4WithHandler(handler: "soun" | "vide"): Buffer {
  const hdlrPayload = Buffer.concat([
    Buffer.alloc(8),
    Buffer.from(handler, "ascii"),
    Buffer.alloc(4)
  ]);

  const hdlr = box("hdlr", hdlrPayload);
  const mdia = box("mdia", hdlr);
  const trak = box("trak", mdia);
  const moov = box("moov", trak);
  return Buffer.concat([box("ftyp", Buffer.alloc(8)), moov]);
}

function box(type: string, payload: Buffer): Buffer {
  const output = Buffer.alloc(8 + payload.length);
  output.writeUInt32BE(output.length, 0);
  output.write(type, 4, "ascii");
  payload.copy(output, 8);
  return output;
}
