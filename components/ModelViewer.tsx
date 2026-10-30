"use client";
import { useLab } from "./context";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
  OrbitControls,
  useGLTF,
  ContactShadows,
} from "@react-three/drei";
import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone(true)} />;
}
// 실제 GLB 파일을 읽습니다. GPU·파일 오류일 때에는 같은 내용의 SVG로 바꿉니다.
export default function ModelViewer({
  name = "croissant",
  compact = false,
}: {
  name?: string;
  compact?: boolean;
}) {
  const { boot, profileId } = useLab();
  const home = boot?.user.settings.find((s) => s.kind === "model-preference");
  const customId = compact ? home?.homeModelId : null;
  const configured = compact ? boot?.assets.home : null;
  const url = customId
    ? `/api/features/models/${encodeURIComponent(customId)}?profileId=${profileId}`
    : (configured ?? `/assets/models/${name}.glb`);
  const custom = !!(customId || configured);
  const [supported, setSupported] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [reset, setReset] = useState(0);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    setSupported(!!context);
    if (context) context.getExtension("WEBGL_lose_context")?.loseContext();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setRotate(
        !reduced.matches &&
          localStorage.getItem("baking-reduce-motion") !== "true",
      );
    update();
    reduced.addEventListener("change", update);
    window.addEventListener("baking-motion-change", update);
    return () => {
      reduced.removeEventListener("change", update);
      window.removeEventListener("baking-motion-change", update);
    };
  }, []);
  const fallback = (
    <img
      className="model-fallback"
      src={
        custom
          ? "/assets/illustrations/bread.svg"
          : `/assets/models/${name}-poster.svg`
      }
      alt="빵의 형태를 보여주는 직접 제작 삽화"
    />
  );
  return (
    <div className={`model-viewer ${compact ? "compact" : ""}`}>
      <div
        className="model-canvas"
        aria-label="드래그하면 회전하고 휠 또는 두 손가락으로 확대할 수 있는 3D 베이킹 오브제"
      >
        {supported ? (
          <ModelBoundary key={url + reset} fallback={fallback}>
            <Canvas
              camera={{ position: [4, 3, 5], fov: 38 }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={1.8} />
              <directionalLight position={[5, 8, 5]} intensity={3} />
              <directionalLight position={[-4, 2, -2]} intensity={1} />
              <Suspense fallback={null}>
                <Bounds fit clip observe margin={1.4}>
                  <Center>
                    <Model url={url} />
                  </Center>
                </Bounds>
                <ContactShadows
                  position={[0, -1.2, 0]}
                  opacity={0.16}
                  scale={12}
                  blur={3}
                  far={5}
                />
              </Suspense>
              <OrbitControls
                makeDefault
                autoRotate={rotate}
                autoRotateSpeed={1}
                enablePan={false}
              />
            </Canvas>
          </ModelBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="model-controls">
        <span>드래그해서 돌려보세요</span>
        <button className="text-button" onClick={() => setRotate(!rotate)}>
          {rotate ? "회전 멈추기" : "자동 회전"}
        </button>
        {!compact && (
          <button
            className="text-button"
            onClick={() => setReset((x) => x + 1)}
          >
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
