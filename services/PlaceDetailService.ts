type PlaceDetails = {
  id?: string;
  title?: string;
  description?: string;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  cuisine?: string | null;
  email?: string | null;
  photos?: { url: string }[];
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";

export default class FreePlaceDetailsService {
  static async fetchByName(
    name: string,
    lat?: number,
    lon?: number,
  ): Promise<PlaceDetails | null> {
    try {
      const url = new URL(NOMINATIM_BASE);
      url.searchParams.set("q", name);
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("extratags", "1");
      url.searchParams.set("limit", "1");
      if (lat && lon) {
        url.searchParams.set(
          "viewbox",
          `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`,
        );
        url.searchParams.set("bounded", "1");
      }

      const nominatimRes = await fetch(url.toString());
      const places = await nominatimRes.json();
      if (!Array.isArray(places) || places.length === 0) return null;
      const place = places[0];

      const details: PlaceDetails = {
        id: place.osm_id?.toString(),
        title: place.display_name,
        phone: place.extratags?.phone || null,
        website: place.extratags?.website || null,
        opening_hours: place.extratags?.opening_hours || null,
        cuisine: place.extratags?.cuisine || null,
        email: place.extratags?.email || null,
        photos: [],
      };

      if (place.extratags?.wikidata) {
        try {
          const wikidataId = place.extratags.wikidata;
          const wikiRes = await fetch(
            `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
          );
          const wikiData = await wikiRes.json();
          const entity = wikiData.entities[wikidataId];

          details.description =
            entity.descriptions?.en?.value || details.description;

          if (entity.claims?.P18?.length) {
            const filename = entity.claims.P18[0].mainsnak.datavalue.value;
            details.photos?.push({
              url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`,
            });
          }
        } catch {}
      }

      try {
        const overpassQuery = `
          [out:json][timeout:25];
          node(${place.osm_type[0]}${place.osm_id});
          out tags;
        `;
        const overpassRes = await fetch(OVERPASS_BASE, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "OctaraMaps/v3",
          },
          body: "data=" + encodeURIComponent(overpassQuery),
        });
        const overpassData = await overpassRes.json();
        const node = overpassData.elements?.[0];
        if (node?.tags) {
          details.phone = details.phone || node.tags.phone || null;
          details.website = details.website || node.tags.website || null;
          details.opening_hours =
            details.opening_hours || node.tags.opening_hours || null;
          details.cuisine = details.cuisine || node.tags.cuisine || null;
          details.email = details.email || node.tags.email || null;
        }
      } catch {}

      return details;
    } catch {
      return null;
    }
  }

  static async fetchById(
    osmType: "N" | "W" | "R",
    osmId: number,
  ): Promise<PlaceDetails | null> {
    try {
      const typeMap: Record<string, string> = { N: "node", W: "way", R: "relation", node: "node", way: "way", relation: "relation" };
      const overpassQuery = `
      [out:json][timeout:25];
      ${typeMap[osmType] || osmType.toLowerCase()}(${osmId});
      out tags;
    `;
      const overpassRes = await fetch(OVERPASS_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "OctaraMaps/v3",
        },
        body: "data=" + encodeURIComponent(overpassQuery),
      });

      if (!overpassRes.ok) {
        return null;
      }

      const overpassData = await overpassRes.json();
      const element = overpassData.elements?.[0];
      if (!element) {
        return null;
      }

      const details: PlaceDetails = {
        id: osmId.toString(),
        title: element.tags?.name || undefined,
        phone: element.tags?.phone || null,
        website: element.tags?.website || null,
        opening_hours: element.tags?.opening_hours || null,
        cuisine: element.tags?.cuisine || null,
        email: element.tags?.email || null,
        photos: [],
      };

      if (element.tags?.wikidata) {
        try {
          const wikidataId = element.tags.wikidata;
          const wikiRes = await fetch(
            `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
          );
          const wikiData = await wikiRes.json();
          const entity = wikiData.entities[wikidataId];
          details.description =
            entity.descriptions?.en?.value || details.description;

          if (entity.claims?.P18?.length) {
            const filename = entity.claims.P18[0].mainsnak.datavalue.value;
            details.photos?.push({
              url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`,
            });
          }
        } catch {}
      }

      return details;
    } catch {
      return null;
    }
  }
}
