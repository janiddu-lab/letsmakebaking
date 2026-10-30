"""외부 사진 없이 직접 그린 SVG와 실제 GLB 베이킹 학습 자산을 만듭니다."""
from pathlib import Path
from collections import defaultdict
import json
import math
import struct

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
ILLUSTRATIONS = ROOT / "illustrations"
TEMPLATES = ROOT / "templates"
for directory in (MODELS, ILLUSTRATIONS, TEMPLATES):
    directory.mkdir(parents=True, exist_ok=True)

MATERIALS = [
    ("노릇한 빵 껍질", [0.68, 0.30, 0.075, 1], .82),
    ("밝은 구움색", [0.91, 0.59, 0.23, 1], .86),
    ("부드러운 빵 속", [0.98, 0.84, 0.56, 1], .95),
    ("초콜릿", [0.17, 0.065, 0.035, 1], .72),
    ("아이싱", [0.98, 0.95, 0.85, 1], .42),
    ("분홍 아이싱", [0.89, 0.48, 0.47, 1], .49),
    ("딸기", [0.66, 0.12, 0.11, 1], .58),
    ("잎", [0.23, 0.36, 0.17, 1], .9),
    ("페이스트리 접힌 면의 진한 구움색", [0.29, 0.085, 0.012, 1], .88),
    ("크루아상 황금빛 표면", [0.66, 0.255, 0.035, 1], .76),
    ("페이스트리 층의 밝은 모서리", [0.80, 0.40, 0.075, 1], .79),
]


class Scene:
    def __init__(self):
        self.parts = defaultdict(lambda: [[], [], []])

    def sphere(self, center, scale, material=0, rotation=0, segments=28, rings=16):
        """타원체를 만들고 역전치 스케일로 법선을 계산해 조명이 자연스럽게 보이게 합니다."""
        positions, normals, indices = self.parts[material]
        offset = len(positions) // 3
        co, si = math.cos(rotation), math.sin(rotation)
        for j in range(rings + 1):
            phi = math.pi * j / rings
            for i in range(segments + 1):
                theta = 2 * math.pi * i / segments
                unit = (math.sin(phi) * math.cos(theta), math.cos(phi), math.sin(phi) * math.sin(theta))
                x, y, z = [unit[k] * scale[k] for k in range(3)]
                positions.extend([center[0] + x * co + z * si, center[1] + y, center[2] - x * si + z * co])
                nx, ny, nz = [unit[k] / max(scale[k], .001) for k in range(3)]
                nx, nz = nx * co + nz * si, -nx * si + nz * co
                norm = math.sqrt(nx * nx + ny * ny + nz * nz)
                normals.extend([nx / norm, ny / norm, nz / norm])
        for j in range(rings):
            for i in range(segments):
                a = offset + j * (segments + 1) + i
                b = a + segments + 1
                indices.extend([a, a + 1, b, a + 1, b + 1, b])

    def tube_arc(self, material=0, radius=1.0, tube=.32, arc=math.pi * 1.35, y=.05, taper=True):
        """끝으로 갈수록 가늘어지는 곡선 관으로 크루아상과 아이싱 선을 만듭니다."""
        positions, normals, indices = self.parts[material]
        offset = len(positions) // 3
        longitudinal, radial = 96, 18
        for i in range(longitudinal + 1):
            u = i / longitudinal
            t = (u - .5) * arc
            thickness = tube * (.18 + .82 * math.sin(math.pi * u) ** .65) if taper else tube
            # 부풀어 오른 반죽의 마디를 실제 기하로 만들어 회전해도 층이 드러나게 합니다.
            thickness *= 1 + .13 * math.cos(u * math.pi * 18)
            cx, cz = radius * math.cos(t), radius * math.sin(t)
            for j in range(radial + 1):
                v = 2 * math.pi * j / radial
                nx, ny, nz = math.cos(t) * math.cos(v), math.sin(v), math.sin(t) * math.cos(v)
                positions.extend([cx + thickness * nx - .34, y + thickness * ny, cz + thickness * nz])
                normals.extend([nx, ny, nz])
        for i in range(longitudinal):
            for j in range(radial):
                a = offset + i * (radial + 1) + j
                b = a + radial + 1
                indices.extend([a, a + 1, b, a + 1, b + 1, b])

    def pastry_ridge(self, u, material, ring_offset=0, minor=.017):
        """반죽 둘레를 감싸는 층의 모서리입니다. 얇은 고리로 앞뒤에서 마디를 읽게 합니다."""
        positions, normals, indices = self.parts[material]
        offset = len(positions) // 3
        t = (u - .5) * math.pi * 1.35
        thickness = .36 * (.18 + .82 * math.sin(math.pi * u) ** .65)
        thickness *= 1 + .13 * math.cos(u * math.pi * 18)
        thickness += ring_offset
        radial = (math.cos(t), 0, math.sin(t))
        tangent = (-math.sin(t), 0, math.cos(t))
        center = (math.cos(t)-.34, .05, math.sin(t))
        around, cross = 28, 6
        for i in range(around+1):
            v = 2 * math.pi * i / around
            normal = (radial[0]*math.cos(v), math.sin(v), radial[2]*math.cos(v))
            for j in range(cross+1):
                w = 2 * math.pi * j / cross
                n = [normal[k]*math.cos(w)+tangent[k]*math.sin(w) for k in range(3)]
                positions.extend([center[k]+thickness*normal[k]+minor*n[k] for k in range(3)])
                normals.extend(n)
        for i in range(around):
            for j in range(cross):
                a=offset+i*(cross+1)+j
                b=a+cross+1
                indices.extend([a,b,a+1,a+1,b,b+1])

    def cylinder(self, center, radius, height, material=0, segments=48):
        """잘린 단면과 케이크 층을 표현하는 원기둥입니다."""
        positions, normals, indices = self.parts[material]
        for side in (-1, 1):
            offset = len(positions) // 3
            positions.extend([center[0], center[1] + side * height / 2, center[2]])
            normals.extend([0, side, 0])
            for i in range(segments + 1):
                t = i * 2 * math.pi / segments
                positions.extend([center[0] + radius * math.cos(t), center[1] + side * height / 2, center[2] + radius * math.sin(t)])
                normals.extend([0, side, 0])
            for i in range(segments):
                a, b = offset + i + 1, offset + i + 2
                indices.extend([offset, b, a] if side > 0 else [offset, a, b])
        offset = len(positions) // 3
        for i in range(segments + 1):
            t = i * 2 * math.pi / segments
            for side in (-1, 1):
                positions.extend([center[0] + radius * math.cos(t), center[1] + side * height / 2, center[2] + radius * math.sin(t)])
                normals.extend([math.cos(t), 0, math.sin(t)])
        for i in range(segments):
            a = offset + i * 2
            indices.extend([a, a + 1, a + 2, a + 1, a + 3, a + 2])

    def save(self, filename, description):
        """GLB 2.0의 JSON과 BIN 청크를 4바이트 정렬해 기록합니다."""
        binary = bytearray()
        views, accessors, meshes, nodes = [], [], [], []

        def accessor(values, kind, component=5126, target=34962):
            while len(binary) % 4:
                binary.append(0)
            byte_offset = len(binary)
            fmt = "f" if component == 5126 else "I"
            binary.extend(struct.pack("<" + fmt * len(values), *values))
            view_index = len(views)
            views.append({"buffer": 0, "byteOffset": byte_offset, "byteLength": len(binary) - byte_offset, "target": target})
            dimensions = 3 if kind == "VEC3" else 1
            entry = {"bufferView": view_index, "componentType": component, "count": len(values) // dimensions, "type": kind}
            if kind == "VEC3":
                entry["min"] = [min(values[k::3]) for k in range(3)]
                entry["max"] = [max(values[k::3]) for k in range(3)]
            accessors.append(entry)
            return len(accessors) - 1

        for material, (positions, normals, indices) in self.parts.items():
            assert all(math.isfinite(v) for v in positions + normals)
            primitive = {"attributes": {"POSITION": accessor(positions, "VEC3"), "NORMAL": accessor(normals, "VEC3")}, "indices": accessor(indices, "SCALAR", 5125, 34963), "material": material}
            meshes.append({"name": MATERIALS[material][0], "primitives": [primitive]})
            nodes.append({"mesh": len(meshes) - 1, "name": MATERIALS[material][0]})
        data = {
            "asset": {"version": "2.0", "generator": "우리집 베이킹랩 원본 자산 생성기", "copyright": "CC0 1.0 · original procedural geometry"},
            "scene": 0, "scenes": [{"name": description, "nodes": list(range(len(nodes)))}],
            "nodes": nodes, "meshes": meshes,
            "materials": [{"name": name, "doubleSided": True, "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0, "roughnessFactor": rough}} for name, color, rough in MATERIALS],
            "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors,
        }
        encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        encoded += b" " * ((-len(encoded)) % 4)
        binary += b"\0" * ((-len(binary)) % 4)
        total = 12 + 8 + len(encoded) + 8 + len(binary)
        glb = struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(encoded), b"JSON") + encoded + struct.pack("<I4s", len(binary), b"BIN\0") + binary
        (MODELS / filename).write_bytes(glb)


# 둥근 빵과 표면의 칼집을 각각의 타원체로 표현합니다.
boule = Scene()
boule.sphere((0, 0, 0), (1.25, .86, 1.08), 0)
for x in (-.47, 0, .47):
    boule.sphere((x, .76 - abs(x) * .12, 0), (.065, .03, .62), 2, -.3)
boule.save("boule.glb", "둥근 빵의 구움색과 칼집")

brioche = Scene()
for x in (-.62, 0, .62):
    for z in (-.35, .35):
        brioche.sphere((x, 0, z), (.48, .55, .47), 1)
brioche.save("brioche.glb", "여섯 덩어리로 나눈 브리오슈 모양")

croissant = Scene()
croissant.tube_arc(9, 1, .36)
# 진한 접힘과 바로 옆 밝은 모서리를 짝지어 강한 주변광 아래에서도 층을 구별합니다.
for i in range(1, 9):
    u = i / 9
    croissant.pastry_ridge(u, 8, ring_offset=.006, minor=.021)
    croissant.pastry_ridge(u+.012, 10, ring_offset=.008, minor=.016)
croissant.save("croissant.glb", "황금빛 크루아상의 겹친 반죽과 구운 마디")

shaping = Scene()
shaping.sphere((-1.15, 0, 0), (.48, .15, .48), 2)
shaping.sphere((0, 0, 0), (.42, .32, .42), 2)
shaping.sphere((1.15, 0, 0), (.43, .44, .43), 1)
shaping.save("shaping.glb", "펴기 모으기 둥글리기 순서 예시")

crumb = Scene()
crumb.cylinder((0, 0, 0), 1.05, .6, 0)
crumb.cylinder((0, .31, 0), .98, .015, 2)
for x, z, radius in [(-.5,-.35,.15),(-.17,-.51,.1),(.22,-.45,.13),(.53,-.12,.1),(.17,.12,.16),(-.36,.2,.11),(.4,.49,.12),(-.1,.56,.1)]:
    crumb.sphere((x, .32, z), (radius, .015, radius*.8), 1)
crumb.save("crumb.glb", "빵 단면의 기공을 개념적으로 나타낸 모형")

icing = Scene()
icing.cylinder((0,-.2,0), 1, .5, 1)
icing.cylinder((0,.07,0), 1.01, .05, 4)
icing.cylinder((0,.23,0), .99, .25, 1)
icing.cylinder((0,.38,0), 1.01, .06, 5)
for i in range(12):
    t = i * 2 * math.pi / 12
    icing.sphere((.83*math.cos(t), .47, .83*math.sin(t)), (.11,.13,.11),4)
for i in range(3):
    t=i*2*math.pi/3
    icing.sphere((.27*math.cos(t),.55,.27*math.sin(t)),(.16,.23,.16),6)
icing.save("icing.glb", "케이크 층과 아이싱 장식")


def svg_scene(kind):
    """실제 사진과 혼동되지 않도록 부드러운 벡터 삽화로 음식을 그립니다."""
    start = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#f8edda"/><stop offset="1" stop-color="#e8d6bd"/></linearGradient><linearGradient id="bread" x2=".4" y2="1"><stop stop-color="#eebd6c"/><stop offset=".55" stop-color="#bd702e"/><stop offset="1" stop-color="#95501f"/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="10"/></filter></defs><rect width="640" height="440" rx="26" fill="url(#bg)"/><ellipse cx="325" cy="344" rx="200" ry="27" fill="#957250" opacity=".16" filter="url(#shadow)"/><ellipse cx="320" cy="335" rx="215" ry="47" fill="#fdf9ef"/><ellipse cx="320" cy="338" rx="183" ry="31" fill="none" stroke="#ddd2c0" stroke-width="2"/>'''
    end = '<g fill="#fff7e6" opacity=".6"><circle cx="102" cy="92" r="3"/><circle cx="509" cy="130" r="4"/><circle cx="550" cy="266" r="2"/></g></svg>'
    bodies = {
        "croissant": '<path d="M145 305c-29-83 24-178 111-197 94-22 194 28 219 111 9 30 9 56-3 86-20-49-49-82-82-95-48-19-102-6-139 31-19 18-32 40-37 64-10-8-15-6-23 0Z" fill="url(#bread)" stroke="#9b5324" stroke-width="3"/><g fill="none" stroke="#8d431b" stroke-width="8" stroke-linecap="round"><path d="M183 189c6 31 22 62 48 87"/><path d="M225 137c-1 38 10 75 33 108"/><path d="M280 113c-9 40-8 74 4 113"/><path d="M338 118c-15 37-19 69-16 99"/><path d="M394 144c-23 29-34 53-38 80"/><path d="M440 186c-24 17-38 34-49 54"/></g><g fill="none" stroke="#f5c677" stroke-width="5" stroke-linecap="round"><path d="M193 182c7 30 21 56 43 79"/><path d="M237 135c-1 36 9 69 27 96"/><path d="M293 115c-10 36-8 72 1 103"/><path d="M350 123c-13 30-16 59-15 91"/><path d="M405 151c-22 23-34 47-38 69"/><path d="M450 199c-20 12-32 26-44 45"/></g>',
        "bread": '<path d="M151 282C143 178 206 114 320 114s181 66 170 168c-23 79-308 80-339 0Z" fill="url(#bread)"/><path d="m223 196 65-37m-24 95 76-79m-10 103 80-95" stroke="#f9dc9c" stroke-width="15" stroke-linecap="round"/><path d="M171 291c67 31 230 38 295 0" fill="none" stroke="#7e431c" opacity=".3" stroke-width="5"/>',
        "cookie": '<g fill="url(#bread)" stroke="#bc7837" stroke-width="3"><ellipse cx="246" cy="245" rx="100" ry="79" transform="rotate(-16 246 245)"/><ellipse cx="389" cy="274" rx="102" ry="74" transform="rotate(17 389 274)"/><ellipse cx="340" cy="182" rx="98" ry="76"/></g><g fill="#553124"><path d="m214 224 16-7 11 17-22 8Z"/><path d="m268 263 21-2 4 19-18 7Z"/><path d="m319 156 17 7-8 20-19-8Z"/><path d="m371 180 21-6 7 20-21 6Z"/><path d="m344 266 18-6 10 19-21 5Z"/><path d="m418 280 18 1 3 19-25 2Z"/><path d="m249 187 13 4-3 16-20-5Z"/></g>',
        "cake": '<path d="M185 207h270v94c0 35-270 35-270 0Z" fill="#d49a63"/><path d="M185 242c70 21 199 21 270 0v27c-64 21-210 21-270 0Z" fill="#fff6e8"/><ellipse cx="320" cy="209" rx="135" ry="35" fill="#f6dfd8"/><g fill="#fffaf0">'+''.join(f'<ellipse cx="{205+i*23}" cy="204" rx="15" ry="17"/>' for i in range(11))+'</g><g fill="#b8453c"><path d="M270 171c-30-34 2-57 20-29 23-23 46 5 14 35Z"/><path d="M334 165c-27-35 7-56 25-26 24-19 42 10 8 35Z"/></g>',
        "scone": '<path d="m176 285 112-128 58 145Z" fill="#c98644"/><path d="m176 261 112-128 58 145Z" fill="#e6b56d"/><path d="m327 287 91-117 62 138Z" fill="#bb783d"/><path d="m327 265 91-117 62 138Z" fill="#edc786"/><g fill="#9b6040"><ellipse cx="276" cy="208" rx="8" ry="6"/><ellipse cx="235" cy="235" rx="6" ry="5"/><ellipse cx="409" cy="236" rx="7" ry="5"/></g><path d="m201 275 133 15m11-9 119 15" stroke="#f8deb0" stroke-width="8"/>',
        "nobake": '<path d="M209 190h222l-22 135H230Z" fill="#a8c6c1" opacity=".8"/><path d="m222 271 196 1-8 49H230Z" fill="#d1a26c"/><path d="m216 224 207 1-5 49-197-3Z" fill="#fff7e6"/><ellipse cx="320" cy="190" rx="111" ry="31" fill="#fff9ed"/><path d="M257 171c-28-36 8-59 27-28 24-25 49 7 15 37Z" fill="#bd5246"/><path d="M326 175c-32-35 4-65 26-32 23-24 52 6 17 38Z" fill="#d16253"/><ellipse cx="354" cy="139" rx="16" ry="7" transform="rotate(-30 354 139)" fill="#587554"/>',
        "quick": '<path d="M216 192h180v119c0 53-180 53-180 0Z" fill="#e7cbb0"/><path d="M394 222c82-15 79 85 2 76" fill="none" stroke="#c69e7b" stroke-width="22"/><ellipse cx="306" cy="192" rx="90" ry="27" fill="#e1b376"/><path d="M226 188c-9-93 161-99 163 0" fill="url(#bread)"/><path d="m270 167 22-18m31 21 23-20" stroke="#f7dba9" stroke-width="8" stroke-linecap="round"/><path d="M286 93c-26-20 22-30 3-52m39 47c-22-17 21-24 4-45" fill="none" stroke="#ae8f75" stroke-width="5" stroke-linecap="round" opacity=".5"/>',
    }
    return start + bodies[kind] + end


for kind in ("cookie", "bread", "cake", "scone", "nobake", "quick", "croissant"):
    (ILLUSTRATIONS / f"{kind}.svg").write_text(svg_scene(kind), encoding="utf-8")

# 모델 대체 화면도 자산 목록에 기록하여 WebGL 실패를 숨기지 않습니다.
for model, category in [("boule","bread"),("brioche","bread"),("croissant","croissant"),("shaping","bread"),("crumb","bread"),("icing","cake")]:
    (MODELS / f"{model}-poster.svg").write_text(svg_scene(category), encoding="utf-8")

role_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 460" role="img" aria-label="재료의 역할 연결 지도"><rect width="800" height="460" rx="24" fill="#fbf5ea"/><g stroke="#d8c3a8" stroke-width="3"><path d="m400 230-240-120m240 120 240-120m-240 120-240 120m240-120 240 120m-240-120V75m0 155v155"/></g><g fill="#fff" stroke="#d7c3a9" stroke-width="2"><circle cx="400" cy="230" r="73"/><circle cx="160" cy="110" r="61"/><circle cx="640" cy="110" r="61"/><circle cx="160" cy="350" r="61"/><circle cx="640" cy="350" r="61"/><circle cx="400" cy="75" r="55"/><circle cx="400" cy="385" r="55"/></g><g text-anchor="middle" font-family="Malgun Gothic, sans-serif" fill="#62442f"><text x="400" y="238" font-size="26" font-weight="700">재료의 역할</text><text x="160" y="118" font-size="23">구조</text><text x="640" y="118" font-size="23">수분</text><text x="160" y="358" font-size="23">지방</text><text x="640" y="358" font-size="23">팽창</text><text x="400" y="83" font-size="23">결합</text><text x="400" y="393" font-size="23">단맛</text></g></svg>'''
(ILLUSTRATIONS / "ingredient-roles.svg").write_text(role_svg, encoding="utf-8")

template_paths = {
    "heart": ('하트', 'M105 136C67 110 58 85 74 74c13-9 26-2 31 9 6-12 19-18 31-9 17 13 7 38-31 62Z'),
    "star": ('별', 'M105 68 115 94 143 95 121 113 128 140 105 124 82 140 89 113 67 95 95 94Z'),
    "flower": ('꽃', 'M105 77C93 57 72 73 81 91 57 88 56 116 79 117 65 137 88 153 101 134 109 157 135 145 127 124 151 127 155 100 132 95 148 78 126 61 113 80 110 76 107 75 105 77Z'),
    "house": ('집', 'M69 101 105 69 141 101 134 101 134 139 115 139 115 116 96 116 96 139 76 139 76 101Z'),
}
for name,(title,path) in template_paths.items():
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" role="img" aria-label="{title} 쿠키 모양 도안"><rect width="210" height="297" fill="white"/><g font-family="Malgun Gothic, sans-serif" fill="#333"><text x="18" y="22" font-size="7" font-weight="700">{title} 쿠키 모양 도안</text><text x="18" y="34" font-size="3.6">실제 크기 100%로 인쇄하세요. 페이지에 맞춤을 끄세요.</text><text x="18" y="42" font-size="3.6">자르기와 모양 확인용 가이드입니다. 종이를 오븐에 넣지 마세요.</text><text x="18" y="50" font-size="3.6">식품 접촉에는 적합한 재질을 별도로 사용하고 위생을 지켜 주세요.</text></g><path d="{path}" fill="none" stroke="#222" stroke-width=".65"/><path d="M20 176h10m-10-2v4m10-4v4" fill="none" stroke="#222" stroke-width=".4"/><text x="20" y="185" font-family="Malgun Gothic, sans-serif" font-size="3.8">이 선이 1cm인지 자로 확인하세요.</text><g font-family="Malgun Gothic, sans-serif" font-size="4" fill="#333"><text x="18" y="208">1. 1cm 검정 눈금으로 인쇄 크기를 확인합니다.</text><text x="18" y="220">2. 가위를 안전하게 사용해 바깥선을 잘라 모양을 확인합니다.</text><text x="18" y="232">3. 별도의 식품용 가이드 재질로 옮겨 반죽 모양을 잡습니다.</text><text x="18" y="244">4. 종이 가이드를 제거하고 레시피의 굽기 도구를 사용합니다.</text><text x="18" y="275" font-size="3.5">우리집 베이킹랩 직접 제작 도안 · CC0 1.0</text></g></svg>'''
    (TEMPLATES / f"cookie-{name}.svg").write_text(svg,encoding="utf-8")

assets = []
for path in sorted(ROOT.rglob("*")):
    if path.is_file() and path.suffix in (".svg", ".glb"):
        kind = "model" if path.suffix == ".glb" else ("template" if path.parent.name == "templates" else "illustration")
        assets.append({"id":path.stem, "kind":kind, "path":"/assets/"+path.relative_to(ROOT).as_posix(), "byteSize":path.stat().st_size,"author":"우리집 베이킹랩 원본 제작", "license":"CC0-1.0", "sourceUrl":None, "permittedUse":"직접 제작한 절차적 도형과 벡터 삽화. 외부 저작물 포함 없음.","reviewStatus":"ORIGINAL_ASSET","isPhotograph":False})
manifest = {"version":1,"generatedAt":"2026-10-29","notice":"모든 모델·삽화·도안은 직접 제작한 설명용 자산입니다. 실제 제조 결과나 물리 예측을 나타내지 않습니다.","assets":assets,"models":[{"id":name,"title":title,"path":f"/assets/models/{name}.glb","poster":f"/assets/models/{name}-poster.svg"} for name,title in [("boule","둥근 빵"),("brioche","브리오슈"),("croissant","크루아상"),("shaping","성형 순서"),("crumb","빵 단면"),("icing","아이싱 케이크")]]}
(ROOT / "manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")

print(json.dumps({"models":len(list(MODELS.glob('*.glb'))),"svg":len(list(ROOT.rglob('*.svg'))),"totalBytes":sum(a['byteSize'] for a in assets)},ensure_ascii=False))
