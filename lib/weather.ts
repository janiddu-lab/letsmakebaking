// 좌표는 선택한 도시 중심부입니다. GPS나 사용자의 실제 위치는 요청하지 않습니다.
export const weatherCities: Record<string, { name: string; lat: number; lon: number }> = {
  seoul: { name: "서울", lat: 37.57, lon: 126.98 }, busan: { name: "부산", lat: 35.18, lon: 129.08 },
  daegu: { name: "대구", lat: 35.87, lon: 128.6 }, daejeon: { name: "대전", lat: 36.35, lon: 127.38 },
  gwangju: { name: "광주", lat: 35.16, lon: 126.85 }, jeju: { name: "제주", lat: 33.5, lon: 126.53 },
};
export type CityWeather = { kind: string; city: string; cityName: string; temperature: number; humidity: number; weatherTime: string; fetchedAt: string; source: string; sourceUrl: string };
export async function fetchCityWeather(cityId: string, fetcher: typeof fetch = fetch): Promise<CityWeather> {
  const city = weatherCities[cityId];
  if (!city) throw new Error("도시를 선택하세요.");
  const params = new URLSearchParams({ latitude: String(city.lat), longitude: String(city.lon), current: "temperature_2m,relative_humidity_2m", timezone: "Asia/Seoul", forecast_days: "1" });
  const response = await fetcher(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(8000), redirect: "error" });
  if (!response.ok) throw new Error(response.status === 429 ? "날씨 제공자의 요청 한도에 도달했어요." : "날씨 제공자와 연결하지 못했어요.");
  const current = (await response.json())?.current;
  if (!current || !Number.isFinite(current.temperature_2m) || current.temperature_2m < -30 || current.temperature_2m > 55 || !Number.isFinite(current.relative_humidity_2m) || current.relative_humidity_2m < 0 || current.relative_humidity_2m > 100 || typeof current.time !== "string" || !Number.isFinite(Date.parse(current.time))) throw new Error("날씨 응답의 온도·습도·기준 시각을 확인하지 못했어요.");
  return { kind: "weather", city: cityId, cityName: city.name, temperature: current.temperature_2m, humidity: current.relative_humidity_2m, weatherTime: current.time, fetchedAt: new Date().toISOString(), source: "Open-Meteo · CC BY 4.0", sourceUrl: "https://open-meteo.com/" };
}
const browserCache = new Map<string, CityWeather>();
// 공용 호스팅 연결이 실패하면 브라우저가 공개 API를 한 번 조회합니다. 재시도 루프는 만들지 않습니다.
export async function loadCityWeather(city: string, server: () => Promise<CityWeather>, fetcher: typeof fetch = fetch) {
  const cached = browserCache.get(city);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 600000) return cached;
  let weather: CityWeather;
  try { weather = await server(); }
  catch { weather = await fetchCityWeather(city, fetcher); }
  browserCache.set(city, weather);
  return weather;
}
