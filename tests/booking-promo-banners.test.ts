import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  parsePromoBanners,
  DEFAULT_PROMO_BANNERS,
  type PromoBannersConfig,
} from "@/lib/booking/customization";

describe("Booking Promo Banners — Customization & Validation Suite", () => {
  test("1. Returns default disabled promo banners on null, undefined or empty values", () => {
    const resNull = parsePromoBanners(null);
    assert.equal(resNull.enabled, false);
    assert.deepEqual(resNull.items, []);

    const resUndefined = parsePromoBanners(undefined);
    assert.equal(resUndefined.enabled, false);
    assert.deepEqual(resUndefined.items, []);

    const resEmpty = parsePromoBanners("");
    assert.equal(resEmpty.enabled, false);
    assert.deepEqual(resEmpty.items, []);

    const resInvalidJson = parsePromoBanners("{ invalid json");
    assert.equal(resInvalidJson.enabled, false);
    assert.deepEqual(resInvalidJson.items, []);
  });

  test("2. Correctly parses valid JSON string or object with 1 to 3 items", () => {
    const raw: PromoBannersConfig = {
      enabled: true,
      items: [
        {
          id: "banner-1",
          type: "image",
          url: "https://example.com/promo1.jpg",
          title: "Combo Especial",
          subtitle: "Desconto de 20% em barba e cabelo",
          badge: "Destaque",
          linkUrl: "https://wa.me/5511999999999",
          buttonText: "Aproveitar",
        },
        {
          id: "banner-2",
          type: "video",
          url: "https://example.com/video.mp4",
          title: "Vídeo Institucional",
          subtitle: "Conheça nosso espaço",
          badge: "Novidade",
        },
      ],
    };

    const parsed = parsePromoBanners(raw);
    assert.equal(parsed.enabled, true);
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0].title, "Combo Especial");
    assert.equal(parsed.items[0].type, "image");
    assert.equal(parsed.items[1].type, "video");
    assert.equal(parsed.items[1].badge, "Novidade");

    // Also works when passed as stringified JSON
    const parsedFromString = parsePromoBanners(JSON.stringify(raw));
    assert.equal(parsedFromString.enabled, true);
    assert.equal(parsedFromString.items.length, 2);
    assert.equal(parsedFromString.items[0].title, "Combo Especial");
  });

  test("3. Filters out items without valid URLs and caps at max 3 items", () => {
    const raw = {
      enabled: true,
      items: [
        { id: "1", type: "image", url: "https://example.com/1.jpg", title: "Arte 1" },
        { id: "2", type: "video", url: "", title: "Arte sem URL" }, // should be ignored
        { id: "3", type: "image", url: "https://example.com/3.jpg", title: "Arte 3" },
        { id: "4", type: "video", url: "https://example.com/4.mp4", title: "Arte 4" },
        { id: "5", type: "image", url: "https://example.com/5.jpg", title: "Arte 5" }, // exceeds max 3
      ],
    };

    const parsed = parsePromoBanners(raw);
    assert.equal(parsed.items.length, 3);
    assert.equal(parsed.items[0].title, "Arte 1");
    assert.equal(parsed.items[1].title, "Arte 3");
    assert.equal(parsed.items[2].title, "Arte 4");
  });

  test("4. Disables banner automatically if no items have URLs", () => {
    const raw = {
      enabled: true,
      items: [
        { id: "1", type: "image", url: "", title: "Sem foto" },
        { id: "2", type: "video", url: "   ", title: "Sem video" },
      ],
    };

    const parsed = parsePromoBanners(raw);
    assert.equal(parsed.enabled, false);
    assert.equal(parsed.items.length, 0);
  });
});
