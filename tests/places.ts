import { locality } from "../src/engine";

// Test localities, all at city grain.
export const seattle = locality(47.6062, -122.3321, { name: "Seattle", timeZone: "America/Los_Angeles" });
export const newYork = locality(40.7128, -74.006, { name: "New York", timeZone: "America/New_York" });
export const london = locality(51.5074, -0.1278, { name: "London", timeZone: "Europe/London" });
export const tokyo = locality(35.6762, 139.6503, { name: "Tokyo", timeZone: "Asia/Tokyo" });
export const quito = locality(-0.1807, -78.4678, { name: "Quito", timeZone: "America/Guayaquil" });
export const sydney = locality(-33.8688, 151.2093, { name: "Sydney", timeZone: "Australia/Sydney" });
export const tromso = locality(69.6492, 18.9553, { name: "Tromsø", timeZone: "Europe/Oslo" });
export const longyearbyen = locality(78.2232, 15.6267, { name: "Longyearbyen", timeZone: "Arctic/Longyearbyen" });
export const rome = locality(41.9028, 12.4964, { name: "Rome", timeZone: "Europe/Rome" });

export const utc = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);
export const minutes = (ms: number) => ms / 60_000;
