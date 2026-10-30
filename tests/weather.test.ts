import { describe, it, expect, vi } from "vitest";
import { fetchCityWeather, loadCityWeather } from "../lib/weather";
const json = (current: unknown) => new Response(JSON.stringify({ current }), { status: 200 });
const current = { temperature_2m: 22.5, relative_humidity_2m: 65, time: "2026-10-30T15:00" };
describe("날씨 조회의 실제 장애 복구", () => {
  it("선택 도시 좌표와 현재 온습도를 요청하고 기준 시각을 유지한다", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json(current));
    const result = await fetchCityWeather("seoul", fetcher);
    expect(fetcher.mock.calls[0]?.[0]).toContain("latitude=37.57");
    expect(result.temperature).toBe(22.5); expect(result.humidity).toBe(65); expect(result.weatherTime).toBe(current.time);
  });
  it("제공자 오류·요청 한도를 성공 값으로 바꾸지 않는다", async () => {
    await expect(fetchCityWeather("seoul", async () => new Response("", { status: 429 }))).rejects.toThrow("한도");
  });
  it.each([{ ...current, relative_humidity_2m: 101 }, { ...current, temperature_2m: null }, { ...current, time: "invalid" }])("잘못된 날씨 응답 %j를 거부한다", async bad => {
    await expect(fetchCityWeather("seoul", async () => json(bad))).rejects.toThrow("응답");
  });
  it("알 수 없는 도시를 외부 요청으로 보내지 않는다", async () => {
    const fetcher = vi.fn(); await expect(fetchCityWeather("invalid", fetcher)).rejects.toThrow("도시"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("서버 실패 시 공개 API로 한 번 복구하고 반복 클릭은 캐시한다", async () => {
    const server = vi.fn(async () => { throw new Error("Render connection failed"); });
    const fetcher = vi.fn(async () => json(current));
    const first = await loadCityWeather("busan", server, fetcher);
    expect(first.cityName).toBe("부산");
    await loadCityWeather("busan", server, fetcher);
    expect(server).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("서버 성공이면 중복 외부 호출을 하지 않는다", async () => {
    const fetcher = vi.fn();
    const result = await fetchCityWeather("jeju", async () => json(current));
    await loadCityWeather("jeju", async () => result, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("서버와 직접 조회 모두 실패하면 직접 입력 안내를 위한 오류를 반환한다", async () => {
    const server = async () => { throw new Error("unavailable"); };
    await expect(loadCityWeather("daegu", server, async () => new Response("", { status: 503 }))).rejects.toThrow("연결");
  });
});
