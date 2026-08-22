const fs = require("fs");
const MeshoptDecoder = require("C:/Users/suraj/AndroidStudioProjects/my-website/node_modules/meshoptimizer/meshopt_decoder.cjs");

async function analyze(file) {
  await MeshoptDecoder.ready;
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.toString("utf8", 20, 20 + jsonLen));
  const binStart = 20 + jsonLen + 8;
  const bin = b.slice(binStart);

  const outBuffers = [];
  for (const bv of json.bufferViews) {
    const ext = bv.extensions && bv.extensions.EXT_meshopt_compression;
    if (!ext) {
      outBuffers.push(bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
      continue;
    }
    const src = bin.slice(ext.byteOffset, ext.byteOffset + ext.byteLength);
    const target = new Uint8Array(bv.byteLength);
    MeshoptDecoder.decodeGltfBuffer(target, ext.count, ext.byteStride, src, ext.mode === "TRIANGLES" ? "TRIANGLES" : "ATTRIBUTES", ext.filter);
    outBuffers.push(target);
  }

  const indicesAcc = json.accessors[0];
  const posAcc = json.accessors[2];
  const indices = new Uint32Array(outBuffers[indicesAcc.bufferView].buffer, indicesAcc.byteOffset, indicesAcc.count);
  const posArr = new Int16Array(outBuffers[posAcc.bufferView].buffer, posAcc.byteOffset, posAcc.count * 3);

  const nVerts = posAcc.count;
  const px = new Float32Array(nVerts);
  const py = new Float32Array(nVerts);
  const pz = new Float32Array(nVerts);
  for (let v = 0; v < nVerts; v++) {
    px[v] = posArr[v * 3] / 32767;
    py[v] = posArr[v * 3 + 1] / 32767;
    pz[v] = posArr[v * 3 + 2] / 32767;
  }

  // Manifold edge check
  const edgeTris = new Map();
  const key = (a, b) => (a < b ? a * 10000000 + b : b * 10000000 + a);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], bb = indices[i + 1], c = indices[i + 2];
    for (const [x, y] of [[a, bb], [bb, c], [c, a]]) {
      const k = key(x, y);
      edgeTris.set(k, (edgeTris.get(k) || 0) + 1);
    }
  }

  const boundary = [];
  const nonManifold = [];
  for (const [k, count] of edgeTris) {
    if (count === 1) boundary.push(k);
    if (count > 2) nonManifold.push(k);
  }

  // Union-find over boundary vertices via boundary edges
  const parent = new Int32Array(nVerts).fill(-1);
  const find = (x) => {
    let r = x;
    while (parent[r] !== -1 && parent[r] !== r) r = parent[r];
    if (parent[r] === -1) { parent[r] = r; return r; }
    while (parent[x] !== r) { const n = parent[x]; parent[x] = r; x = n; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (const k of boundary) {
    const a = Math.floor(k / 10000000);
    const b = k % 10000000;
    union(a, b);
  }

  const comps = new Map();
  for (const k of boundary) {
    const a = Math.floor(k / 10000000);
    const r = find(a);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(k);
  }

  const report = [...comps.values()].map((edges) => {
    const verts = new Set();
    let maxLen = 0, minLen = Infinity, sum = 0;
    let cx = 0, cy = 0, cz = 0;
    let mx0 = 9, my0 = 9, mz0 = 9, mx1 = -9, my1 = -9, mz1 = -9;
    for (const k of edges) {
      const a = Math.floor(k / 10000000);
      const b = k % 10000000;
      verts.add(a); verts.add(b);
      const len = Math.hypot(px[a] - px[b], py[a] - py[b], pz[a] - pz[b]);
      maxLen = Math.max(maxLen, len);
      minLen = Math.min(minLen, len);
      sum += len;
      for (const v of [a, b]) {
        cx += px[v]; cy += py[v]; cz += pz[v];
        mx0 = Math.min(mx0, px[v]); my0 = Math.min(my0, py[v]); mz0 = Math.min(mz0, pz[v]);
        mx1 = Math.max(mx1, px[v]); my1 = Math.max(my1, py[v]); mz1 = Math.max(mz1, pz[v]);
      }
    }
    const n = verts.size;
    const bbox = Math.max(mx1 - mx0, my1 - my0, mz1 - mz0);
    return {
      n, edges: edges.length, maxLen, minLen,
      avgLen: sum / edges.length,
      bbox,
      center: [cx / (n * 2), cy / (n * 2), cz / (n * 2)],
      boxMin: [mx0, my0, mz0], boxMax: [mx1, my1, mz1],
    };
  });

  report.sort((a, b) => a.bbox - b.bbox);

  console.log(`File: ${file}`);
  console.log(`Boundary edges: ${boundary.length}, Non-manifold edges: ${nonManifold.length}`);
  console.log(`Boundary components: ${report.length}`);
  console.log(`Model bbox (from accessor): ${posAcc.min.map((v) => (v / 32767).toFixed(3))} to ${posAcc.max.map((v) => (v / 32767).toFixed(3))}`);
  console.log("\nComponents sorted by bbox size (smallest = likely accidental holes):");
  report.forEach((r, i) => {
    const tag = r.n >= 6 && r.maxLen < 0.35 && r.bbox < 1 ? "  <-- likely HOLE" : "";
    console.log(
      `#${i + 1}: edges=${r.edges} verts=${r.n} avgEdge=${r.avgLen.toFixed(4)} maxEdge=${r.maxLen.toFixed(4)} bbox=${r.bbox.toFixed(3)} center=(${r.center.map((v) => v.toFixed(3))})${tag}`
    );
  });
}

analyze(process.argv[2]).then(() => process.exit(0)).catch((e) => { console.error("ERR", e); process.exit(1); });
