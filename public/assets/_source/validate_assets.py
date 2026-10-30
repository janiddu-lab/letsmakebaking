"""자산 파일의 형식과 삼각형 방향을 확인합니다. 브라우저 실사용 검증은 별도입니다."""
from pathlib import Path
import json
import math
import struct
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
reports = []
for path in sorted((root / 'models').glob('*.glb')):
    data = path.read_bytes()
    magic, version, size = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and size == len(data)
    length, chunk_type = struct.unpack_from('<I4s', data, 12)
    assert chunk_type == b'JSON' and length % 4 == 0
    doc = json.loads(data[20:20+length].decode('utf-8'))
    binary_offset = 20 + length
    bin_length, bin_type = struct.unpack_from('<I4s', data, binary_offset)
    assert bin_type == b'BIN\0' and binary_offset+8+bin_length == len(data)
    binary = data[binary_offset+8:]
    assert len(binary) >= doc['buffers'][0]['byteLength']

    def read(accessor_id):
        accessor = doc['accessors'][accessor_id]
        view = doc['bufferViews'][accessor['bufferView']]
        components = 3 if accessor['type']=='VEC3' else 1
        code = 'f' if accessor['componentType']==5126 else 'I'
        return struct.unpack_from('<'+code*(accessor['count']*components), binary, view.get('byteOffset',0))

    triangles = 0
    reversed_count = 0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            positions = read(primitive['attributes']['POSITION'])
            normals = read(primitive['attributes']['NORMAL'])
            indices = read(primitive['indices'])
            assert len(positions)==len(normals)
            assert max(indices)<len(positions)//3 and len(indices)%3==0
            assert all(math.isfinite(v) for v in positions+normals)
            for k in range(0,len(indices),3):
                a,b,c=indices[k:k+3]
                pa,pb,pc=[positions[i*3:i*3+3] for i in (a,b,c)]
                u=[pb[i]-pa[i] for i in range(3)]
                v=[pc[i]-pa[i] for i in range(3)]
                cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
                area2=sum(x*x for x in cross)
                if area2<1e-15: continue
                triangles+=1
                normal=[sum(normals[index*3+i] for index in (a,b,c))/3 for i in range(3)]
                if sum(cross[i]*normal[i] for i in range(3))<0: reversed_count+=1
    assert reversed_count==0,(path.name,reversed_count,triangles)
    reports.append({'model':path.name,'bytes':len(data),'triangles':triangles,'reversedTriangles':reversed_count})

svg_paths=list(root.rglob('*.svg'))
for path in svg_paths:
    ET.parse(path)
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
for asset in manifest['assets']:
    actual=root/asset['path'].replace('/assets/','',1)
    assert actual.is_file() and actual.stat().st_size==asset['byteSize']
assert len(reports)==6 and len(svg_paths)==18
print(json.dumps({'status':'pass','glb':reports,'svgCount':len(svg_paths),'manifestAssets':len(manifest['assets'])},ensure_ascii=False,indent=2))
