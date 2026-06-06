export type NeerAmenityResponse = {
  id: number;
  type: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}[];

export default class OverpassService {
  static async fetchNeerAmenity(
    lat: number,
    lon: number,
    radius = 1000,
    amenityType: string,
  ): Promise<NeerAmenityResponse> {
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      throw new Error(`Coordonnées invalides : lat=${lat}, lon=${lon}`);
    }

    const query = `[out:json];(node["amenity"~"^(${amenityType})$"](around:${radius},${lat},${lon});way["amenity"~"^(${amenityType})$"](around:${radius},${lat},${lon});relation["amenity"~"^(${amenityType})$"](around:${radius},${lat},${lon}););out center;`;
    const url = "https://overpass.osm.ch/api/interpreter";
    console.log(url, ":", query);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Octara-Maps/v3",
      },
      body: "data=" + encodeURIComponent(query),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ERREUR OVERPASS CRITIQUE :", response.status, errorText);
      throw new Error(`Overpass API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.elements) {
      return [];
    }

    return data.elements.map((element: any) => ({
      id: element.id,
      type: element.type,
      lat: element.lat ?? element.center?.lat,
      lon: element.lon ?? element.center?.lon,
      tags: element.tags || {},
    }));
  }
}
