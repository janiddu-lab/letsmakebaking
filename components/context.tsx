"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Catalog, Entry } from "@/lib/types";
import { browserKitchen } from "@/lib/browser-kitchen";
export type Boot = {
  catalog: Catalog;
  profiles: Entry[];
  profile: Entry;
  user: Record<string, Entry[]>;
  health: { ai: boolean; model: string | null; publicDemo?: boolean; publicCollection?: boolean };
  trends: any;
  assets: any;
};
let csrf = "";
let browserMode = false;
export function photoUrl(id: string, profileId: string) {
  return browserMode ? browserKitchen.photo(id) : `/api/uploads/${encodeURIComponent(id)}?profileId=${encodeURIComponent(profileId)}`;
}
// 모든 변경 요청에 같은 위조 방지 토큰을 붙이고 서버 오류를 한국어로 전달합니다.
export async function api(route: string, body?: any, method?: string, extraHeaders: Record<string, string> = {}) {
  if (browserMode && !route.startsWith("bootstrap")) {
    const local = await browserKitchen.request(route, body, method ?? (body === undefined ? "GET" : "POST"));
    if (local.handled) return local.data;
  }
  const res = await fetch(`/api/${route}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "x-csrf-token": csrf,
      ...extraHeaders,
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.error?.message ?? "요청을 처리하지 못했어요.");
  if (json.meta?.csrfToken) csrf = json.meta.csrfToken;
  if (route.startsWith("bootstrap")) {
    browserMode = !!json.data.health.publicDemo;
    if (browserMode) return browserKitchen.hydrate(json.data, new URL(route, window.location.origin).searchParams.get("profileId") ?? "local-default");
  }
  return json.data;
}
type Context = {
  boot: Boot | null;
  profileId: string;
  setProfile: (id: string) => void;
  refresh: () => Promise<void>;
  act: (fn: () => Promise<any>, message?: string) => Promise<any>;
  save: (kind: string, value: any) => Promise<any>;
  del: (kind: string, id: string) => Promise<any>;
  notify: (message: string) => void;
};
const Lab = createContext<Context | null>(null);
export function LabProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [profileId, setProfileId] = useState("local-default");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    const data = await api(
      `bootstrap?profileId=${encodeURIComponent(profileId)}`,
    );
    setBoot(data);
    if (data.profile?.id && data.profile.id !== profileId) {
      localStorage.setItem("baking-profile", data.profile.id);
      setProfileId(data.profile.id);
    }
    setError("");
  }
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion",localStorage.getItem("baking-reduce-motion")==="true");
    const saved = localStorage.getItem("baking-profile");
    if (saved) setProfileId(saved);
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      if (profileId !== "local-default") {
        localStorage.removeItem("baking-profile");
        setProfileId("local-default");
      }
    });
  }, [profileId]);
  useEffect(() => {
    // 다른 탭에서 주방을 수정했다면 이 탭으로 돌아왔을 때 최신 기록을 읽습니다.
    const update = () => { if (document.visibilityState === "visible") refresh().catch(() => {}); };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [profileId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function act(fn: () => Promise<any>, message?: string) {
    try {
      const result = await fn();
      if (message) setToast(message);
      return result;
    } catch (e) {
      setToast(e instanceof Error ? e.message : "다시 시도해 주세요.");
      return null;
    }
  }
  async function save(kind: string, value: any) {
    const result = await act(
      () => api(`state/${kind}?profileId=${profileId}`, value),
      "저장했어요.",
    );
    if (result) await refresh();
    return result;
  }
  async function del(kind: string, id: string) {
    await act(
      () =>
        api(`state/${kind}/${id}?profileId=${profileId}`, undefined, "DELETE"),
      "삭제했어요.",
    );
    await refresh();
  }
  return (
    <Lab.Provider
      value={{
        boot,
        profileId,
        setProfile: (id) => {
          localStorage.setItem("baking-profile", id);
          setProfileId(id);
        },
        refresh,
        act,
        save,
        del,
        notify: setToast,
      }}
    >
      {error ? (
        <div className="fatal">
          <h1>자료를 불러오지 못했어요</h1>
          <p>{error}</p>
          <button onClick={() => refresh().catch((e) => setError(e.message))}>
            다시 불러오기
          </button>
        </div>
      ) : (
        children
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </Lab.Provider>
  );
}
export function useLab() {
  const value = useContext(Lab);
  if (!value) throw new Error("LabProvider가 필요합니다.");
  return value;
}
export const categories: Record<string, string> = {
  all: "전체",
  cookie: "쿠키",
  bread: "빵",
  cake: "케이크",
  scone: "스콘",
  nobake: "노오븐",
  quick: "빠른 베이킹",
};
export const money = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "미확인"
    : `${Math.round(n).toLocaleString("ko-KR")}원`;
export const amount = (n: number | string | null | undefined) =>
  n === null || n === undefined
    ? "양 미확인"
    : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
export const statusLabel: Record<string, string> = {
  READY: "바로 만들 수 있어요",
  ADAPTABLE: "대체 검토 가능",
  PREPARE: "추가 준비가 필요해요",
  UNKNOWN: "확인이 필요해요",
};
