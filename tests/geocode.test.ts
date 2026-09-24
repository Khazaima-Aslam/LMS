import test from "node:test";
import assert from "node:assert/strict";

import {
  parseNominatimResults,
  parsePhotonResults,
  calculateMapBbox,
} from "../lib/geocode.ts";

test("parses Nominatim geocoding results", () => {
  const result = parseNominatimResults([
    {
      lat: "27.0174",
      lon: "49.6225",
      display_name: "Jubail, Eastern Province, Saudi Arabia",
    },
  ]);

  assert.deepEqual(result, {
    latitude: 27.0174,
    longitude: 49.6225,
    displayName: "Jubail, Eastern Province, Saudi Arabia",
    provider: "nominatim",
  });
});

test("parses Photon geocoding results", () => {
  const result = parsePhotonResults({
    features: [
      {
        geometry: { coordinates: [49.6225, 27.0174] },
        properties: {
          name: "Jubail",
          state: "Eastern Province",
          country: "Saudi Arabia",
        },
      },
    ],
  });

  assert.equal(result?.latitude, 27.0174);
  assert.equal(result?.longitude, 49.6225);
  assert.match(result?.displayName || "", /Jubail/);
  assert.equal(result?.provider, "photon");
});

test("calculates a valid bbox around a point", () => {
  const bbox = calculateMapBbox(27.0174, 49.6225, 10);
  assert.equal(bbox.length, 4);
  assert.ok(bbox[0] < 49.6225);
  assert.ok(bbox[2] > 49.6225);
  assert.ok(bbox[1] < 27.0174);
  assert.ok(bbox[3] > 27.0174);
});
