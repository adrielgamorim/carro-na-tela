import { describe, expect, it } from "vitest";
import { openverseFile } from "./openverse.ts";
import { fillGallery, photosPerGeneration } from "./gallery.ts";
import type { GalleryPhoto } from "./gallery.ts";

const photo = (from: number, file: string, body?: GalleryPhoto["body"]): GalleryPhoto => ({
  file,
  thumb: file,
  angle: "frente",
  from,
  to: from + 4,
  ...(body && { body }),
});

describe("Flickr photos through Openverse", () => {
  it("takes photos under open licenses, with their page and author", () => {
    const image = {
      id: "0a1b2c3d-4e5f",
      title: "2021 Chevrolet Onix LT",
      creator: "Fulano",
      license: "by-sa",
      license_version: "2.0",
      url: "https://live.staticflickr.com/1/123_b.jpg",
      width: 1024,
      height: 683,
      foreign_landing_url: "https://www.flickr.com/photos/456@N00/123",
      tags: [{ name: "chevrolet" }, { name: "onix" }],
    };
    expect(openverseFile(image)).toEqual({
      file: "2021 Chevrolet Onix LT (0a1b2c3d).jpg",
      thumb: "https://live.staticflickr.com/1/123_b.jpg",
      width: 1024,
      height: 683,
      categories: ["chevrolet, onix"],
      artist: "Fulano",
      license: "CC BY-SA 2.0",
      page: "https://www.flickr.com/photos/456@N00/123",
    });
    // Non-commercial, or no size known: not shown.
    expect(openverseFile({ ...image, license: "by-nc" })).toBeUndefined();
    expect(openverseFile({ ...image, width: null })).toBeUndefined();
  });

  it("fills a generation short of photos, not a full one", () => {
    const full = Array.from({ length: photosPerGeneration }, (_, i) => photo(2021, `c${i}`));
    const short = [photo(2016, "c-old")];
    const more = [photo(2021, "f1"), photo(2016, "f2"), photo(2016, "f3", "perua"), photo(2011, "f4")];
    expect(fillGallery([...full, ...short], more).map((item) => item.file).slice(photosPerGeneration)).toEqual([
      "c-old",
      "f2",
      "f3",
      "f4",
    ]);
  });
});
