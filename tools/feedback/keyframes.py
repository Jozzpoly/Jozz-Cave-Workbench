#!/usr/bin/env python3
"""Turn screen recordings into frames that agents can read, named by recording and by the frame's real time.

    python3 -I tools/feedback/keyframes.py 01_PC.mp4 02_PC.mp4 --ids 01_PC,02_PC --out frames/
    python3 -I tools/feedback/keyframes.py 03_PC.mp4 --ids 03_PC --out frames/ --at 01:08,02:23 --dense 0.1 --window 1.5

For every recording it writes, under OUT/<id>/:
    meta.json               file, size, SHA-256, duration, resolution, frame rate, creation time, whether the sound is silent
    <id>_MMmSS.SSs.jpg      full-resolution frames (never downscaled: small interface text must stay readable)
    index.csv               one row per frame: id, requested time, real time (PTS), why it was taken, scene score, file
    sheet_NN.jpg            contact sheets with the time printed on every tile, for a first look

Where frames come from: where the picture changes (scene score), one every N seconds so quiet stretches are covered
too, and around moments named with --at (one second before, the moment, one second after; with --dense, every
DENSE seconds within +-WINDOW, to follow a gesture frame by frame).

Time: a frame is named by its real presentation time in the video (PTS, seconds from the start), read back from
ffmpeg after extraction, not by the time that was asked for. Sampling can land on a frame a little before or after
the requested moment, and variable-frame-rate phone recordings make the gap larger. Both times are kept in
index.csv. Every JPEG also carries its own metadata in a comment segment (recording id, source file, source SHA-256,
requested and real time), so a frame that travels alone still says where it came from.

Needs ffmpeg and ffprobe on PATH; Pillow only for the contact sheets (without it, sheets are skipped).
"""
import argparse, csv, hashlib, json, os, re, subprocess, sys


def run(args):
    return subprocess.run(args, capture_output=True, text=True, errors="replace")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def probe(path):
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path])
    info = json.loads(r.stdout or "{}")
    fmt = info.get("format", {})
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    a = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None)
    rate = lambda x: (lambda n, d: round(float(n) / float(d), 2) if float(d or 0) else None)(*(str(x or "0/1").split("/") + ["1"])[:2])
    meta = {"file": os.path.basename(path), "bytes": int(fmt.get("size", 0) or 0), "sha256": sha256(path),
            "seconds": round(float(fmt.get("duration", 0) or 0), 3), "start_time": float(fmt.get("start_time", 0) or 0),
            "created": (fmt.get("tags") or {}).get("creation_time"),
            "width": v.get("width"), "height": v.get("height"),
            "fps_average": rate(v.get("avg_frame_rate")), "fps_declared": v.get("r_frame_rate"),
            "frames": int(v["nb_frames"]) if str(v.get("nb_frames", "")).isdigit() else None, "audio": bool(a)}
    if a:  # is the sound track actually saying anything?
        r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "volumedetect", "-f", "null", "-"])
        mx = re.search(r"max_volume:\s*(-?[\d.]+) dB", r.stderr)
        meta["audio_max_db"] = float(mx.group(1)) if mx else None
        meta["audio_silent"] = meta["audio_max_db"] is not None and meta["audio_max_db"] < -50
    return meta


def scene_times(path, threshold):
    """Times where the picture changes; detected on a small copy, which is enough to see a change."""
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-an",
             "-vf", f"scale=640:-2,select='gt(scene,{threshold})',metadata=print:file=-", "-f", "null", "-"])
    out, t = [], None
    for line in r.stdout.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1))
            continue
        m = re.search(r"lavfi\.scene_score=([\d.]+)", line)
        if m and t is not None:
            out.append((t, float(m.group(1))))
            t = None
    return out


def mmss(t):
    m, s = divmod(max(0.0, t), 60)
    return f"{int(m):02d}m{s:05.2f}s"


def parse_at(text):
    out = []
    for part in filter(None, (text or "").split(",")):
        part = part.strip()
        if ":" in part:
            m, s = part.split(":", 1)
            out.append(int(m) * 60 + float(s))
        else:
            out.append(float(part))
    return out


def plan(duration, scenes, every, at, burst, dense, window, min_gap):
    cand = []
    for a in at:
        if dense:
            n = int(round(window / dense))
            cand += [(a + k * dense, "dense", None) for k in range(-n, n + 1)]
        else:
            cand += [(a + d, "at", None) for d in ((-burst, 0, burst) if burst else (0,))]
    cand += [(t, "scene", sc) for t, sc in scenes]
    if every:
        n = 0.0
        while n < duration:
            cand.append((n, "every", None))
            n += every
    rank = {"dense": 0, "at": 0, "scene": 1, "every": 2}
    cand = [c for c in cand if 0 <= c[0] <= duration]
    cand.sort(key=lambda x: (rank[x[1]], x[0]))
    kept = []
    for t, why, sc in cand:  # moments asked for always stay; the rest keep their distance
        if why in ("at", "dense") or all(abs(t - k[0]) >= min_gap for k in kept):
            kept.append((round(t, 3), why, sc))
    return sorted(kept)


def add_comment(path, text):
    """Put metadata into the JPEG itself, as a COM segment right after the start-of-image marker (lossless)."""
    b = open(path, "rb").read()
    if b[:2] != b"\xff\xd8":
        return
    c = text.encode("utf-8")[:65000]
    open(path, "wb").write(b[:2] + b"\xff\xfe" + (len(c) + 2).to_bytes(2, "big") + c + b[2:])


def grab(path, t, tmp, quality):
    """Extract the frame shown at time t; return its real presentation time."""
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-copyts", "-ss", f"{t:.3f}", "-i", path,
             "-frames:v", "1", "-vf", "showinfo", "-q:v", str(quality), tmp])
    m = re.search(r"pts_time:\s*([\d.]+)", r.stderr)
    return float(m.group(1)) if (m and os.path.exists(tmp)) else None


def sheets(rows, folder, rid, cols=5, per=20, width=380):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return 0
    try:
        font = ImageFont.load_default(size=20)
    except TypeError:  # Pillow older than 10.1
        font = ImageFont.load_default()
    n = 0
    for i in range(0, len(rows), per):
        chunk = rows[i:i + per]
        tiles = []
        for r in chunk:
            im = Image.open(os.path.join(folder, r["file"])).convert("RGB")
            im.thumbnail((width, width * 3))
            tiles.append((im, r))
        th = max(im.height for im, _ in tiles) + 30
        rows_n = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (width + 8) + 8, rows_n * (th + 8) + 8), (18, 20, 28))
        d = ImageDraw.Draw(sheet)
        for k, (im, r) in enumerate(tiles):
            x, y = 8 + (k % cols) * (width + 8), 8 + (k // cols) * (th + 8)
            sheet.paste(im, (x, y + 30))
            d.text((x + 2, y + 4), f"{rid} {r['mmss'].replace('m', ':').rstrip('s')}  {r['why']}", fill=(235, 235, 235), font=font)
        n += 1
        sheet.save(os.path.join(folder, f"sheet_{n:02d}.jpg"), quality=82)
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--ids", help="comma-separated names for the recordings (default R1, R2, ...), e.g. 01_PC,05_MOBILE")
    ap.add_argument("--every", type=float, default=4.0, help="also take a frame every N seconds (0 = off)")
    ap.add_argument("--scene", type=float, default=0.03, help="scene-change threshold; interfaces change little, keep it low")
    ap.add_argument("--min-gap", type=float, default=0.8, help="seconds between two kept frames (moments from --at excepted)")
    ap.add_argument("--at", default="", help="moments to cover closely: 01:08,02:23.5 (only with a single video)")
    ap.add_argument("--burst", type=float, default=1.0, help="with --at: also take frames this many seconds before and after")
    ap.add_argument("--dense", type=float, default=0.0, help="with --at: a frame every DENSE seconds within +-WINDOW instead")
    ap.add_argument("--window", type=float, default=1.5)
    ap.add_argument("--no-scan", action="store_true", help="only the --at moments: no scene detection, no regular frames")
    ap.add_argument("--quality", type=int, default=2, help="JPEG quality for ffmpeg (2 = best, 31 = worst)")
    a = ap.parse_args()
    ids = a.ids.split(",") if a.ids else [f"R{i + 1}" for i in range(len(a.videos))]
    if len(ids) != len(a.videos):
        sys.exit("--ids must name every video")
    if a.at and len(a.videos) > 1:
        sys.exit("--at needs exactly one video")
    for path, rid in zip(a.videos, ids):
        folder = os.path.join(a.out, rid)
        os.makedirs(folder, exist_ok=True)
        meta = probe(path)
        meta["id"] = rid
        scenes = [] if a.no_scan else scene_times(path, a.scene)
        times = plan(meta["seconds"], scenes, 0 if a.no_scan else a.every, parse_at(a.at), a.burst, a.dense, a.window, a.min_gap)
        index = os.path.join(folder, "index.csv")
        old = list(csv.DictReader(open(index, encoding="utf-8"))) if os.path.exists(index) else []
        rows, seen = [], {r["file"] for r in old}
        tmp = os.path.join(folder, "_grab.jpg")
        for t, why, sc in times:
            pts = grab(path, t, tmp, a.quality)
            if pts is None:
                continue
            name = f"{rid}_{mmss(pts - meta['start_time'])}.jpg"
            if name in seen:  # two requests landed on the same source frame
                os.remove(tmp)
                continue
            seen.add(name)
            add_comment(tmp, json.dumps({"recording": rid, "source": meta["file"], "source_sha256": meta["sha256"],
                                         "requested_s": round(t, 3), "pts_s": round(pts - meta["start_time"], 3), "why": why},
                                        ensure_ascii=False))
            os.replace(tmp, os.path.join(folder, name))
            rows.append({"id": rid, "requested": f"{t:.3f}", "pts": f"{pts - meta['start_time']:.3f}", "mmss": mmss(pts - meta["start_time"]),
                         "why": why, "scene": round(sc, 3) if sc else "", "file": name})
        rows = sorted(old + rows, key=lambda r: float(r["pts"]))
        with open(index, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["id", "requested", "pts", "mmss", "why", "scene", "file"])
            w.writeheader()
            w.writerows(rows)
        meta.update({"frames_taken": len(rows), "scene_changes": len(scenes), "sheets": sheets(rows, folder, rid)})
        json.dump(meta, open(os.path.join(folder, "meta.json"), "w"), ensure_ascii=False, indent=1)
        sound = " · sound silent" if meta.get("audio_silent") else (" · has sound" if meta.get("audio") else " · no sound track")
        print(f"{rid}: {meta['file']} · {meta['seconds']} s · {meta['width']}×{meta['height']} · {meta['fps_average']} fps avg · "
              f"{len(rows)} frames ({len(scenes)} scene changes) · {meta['sheets']} sheets{sound}")


if __name__ == "__main__":
    main()
