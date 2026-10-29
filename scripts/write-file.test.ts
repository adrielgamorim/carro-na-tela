import { describe, expect, it, vi } from "vitest";
import { writeFileRetrying } from "./write-file.ts";

const locked = (code: string) => Object.assign(new Error(`${code}: open`), { code });

describe("writeFileRetrying", () => {
  it("writes once the file is no longer locked", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(locked("UNKNOWN"))
      .mockRejectedValueOnce(locked("EBUSY"))
      .mockResolvedValueOnce(undefined);
    await writeFileRetrying("x.json", "{}", { pauseMs: 1, write });
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("gives up after the last attempt, and at once on other errors", async () => {
    const stillLocked = vi.fn().mockRejectedValue(locked("EPERM"));
    await expect(writeFileRetrying("x.json", "{}", { attempts: 3, pauseMs: 1, write: stillLocked })).rejects.toThrow("EPERM");
    expect(stillLocked).toHaveBeenCalledTimes(3);

    const missing = vi.fn().mockRejectedValue(locked("ENOENT"));
    await expect(writeFileRetrying("x.json", "{}", { pauseMs: 1, write: missing })).rejects.toThrow("ENOENT");
    expect(missing).toHaveBeenCalledTimes(1);
  });
});
