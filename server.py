#!/usr/bin/env python3
"""
Lumen Real Downloader — local backend using yt-dlp + ffmpeg
Run:  python3 server.py
Then open: http://localhost:8000/youtube-glass.html
"""
import http.server, socketserver, urllib.parse, json, subprocess, os, pathlib, mimetypes, re, tempfile, shutil, time, sys

PORT = int(os.environ.get("PORT", 8000))
ROOT = pathlib.Path(__file__).parent.resolve()
YTDLP = ROOT / "yt-dlp"
if not YTDLP.exists():
    YTDLP = pathlib.Path("/tmp/yt-dlp")
if not YTDLP.exists():
    print("yt-dlp not found. Download it: curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && chmod +x yt-dlp")
    sys.exit(1)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200); self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        if parsed.path == "/api/info":
            return self.handle_info(qs)
        if parsed.path == "/api/download":
            return self.handle_download(qs)
        if parsed.path == "/api/direct":
            return self.handle_direct(qs)
        if parsed.path == "/api/health":
            self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers()
            self.wfile.write(json.dumps({"ok":True,"ytdlp":str(YTDLP)}).encode()); return
        return super().do_GET()

    def handle_info(self, qs):
        url = qs.get("url",[None])[0]
        if not url:
            self.send_json(400, {"error":"missing url"}); return
        print(f"[info] {url}")
        # precise retry for info — YT bot blocks some clients, try android first (most stable for this ID)
        last_err = None
        for client in ["android", "android,ios,web", "android,ios", "ios", "web", "tv"]:
            try:
                env = os.environ.copy()
                for p in ["/home/ruby/.deno/bin", "/root/.deno/bin", os.path.expanduser("~/.deno/bin"), "/usr/local/bin"]:
                    if os.path.exists(p+"/deno") or os.path.exists(p):
                        env["PATH"] = p + ":" + env.get("PATH","")
                import shutil as _sh
                _deno = _sh.which("deno", path=env["PATH"])
                base = [str(YTDLP), "--dump-single-json", "--no-playlist", "--no-warnings", "--skip-download", "--extractor-args", f"youtube:player_client={client}"]
                if _deno:
                    base += ["--js-runtimes", "deno"]
                base.append(url)
                print(f"[info try {client}]", " ".join(base))
                out = subprocess.check_output(base, stderr=subprocess.STDOUT, timeout=25, text=True, env=env)
                break
            except subprocess.CalledProcessError as e:
                last_err = e.output
                print(f"[info fail {client}]", last_err[:400])
                if "bot" not in last_err.lower() and "sign in" not in last_err.lower():
                    raise
                continue
        else:
            raise subprocess.CalledProcessError(1, base, output=last_err or "all clients failed")
        data = json.loads(out)
        resp = {
            "id": data.get("id"),
            "title": data.get("title"),
            "uploader": data.get("uploader") or data.get("channel"),
            "thumbnail": data.get("thumbnail") or (data.get("thumbnails",[{}])[-1].get("url") if data.get("thumbnails") else ""),
            "thumbnails": data.get("thumbnails",[]) ,
            "duration": data.get("duration"),
            "duration_string": data.get("duration_string"),
            "view_count": data.get("view_count"),
            "formats": [{"format_id":f.get("format_id"), "ext":f.get("ext"), "height":f.get("height"), "vcodec":f.get("vcodec"), "acodec":f.get("acodec"), "filesize":f.get("filesize")} for f in data.get("formats",[])[:50]],
        }
        self.send_json(200, resp)
        except subprocess.CalledProcessError as e:
            print(e.output[:2000])
            self.send_json(500, {"error":"yt-dlp failed", "detail": e.output[:1500]})
        except Exception as e:
            self.send_json(500, {"error":str(e)})

    def handle_download(self, qs):
        url = qs.get("url",[None])[0]
        mode = qs.get("mode", ["video"])[0]  # video / music
        quality = qs.get("quality", ["720p"])[0]
        ext_req = qs.get("ext", [None])[0]
        if not url:
            self.send_json(400, {"error":"missing url"}); return
        # extract id for filename
        m = re.search(r"(?:v=|\.be/|/shorts/|/embed/)([A-Za-z0-9_-]{11})", url)
        if not m and re.match(r"^[A-Za-z0-9_-]{11}$", url):
            vid = url.strip()
        elif m:
            vid = m.group(1)
        else:
            vid = "video"
        print(f"[download] {url} mode={mode} q={quality} ext={ext_req}")
        tmpdir = pathlib.Path(tempfile.gettempdir()) / "lumen_dl"
        tmpdir.mkdir(exist_ok=True)
        # clean old
        for p in tmpdir.glob("lumen_*"):
            try:
                if time.time() - p.stat().st_mtime > 3600: p.unlink()
            except: pass

        # decide output template and format
        if mode == "video":
            # map quality to height
            hmap = {"4K":"2160","2160p":"2160","1080p":"1080","720p":"720","480p":"480","360p":"360"}
            h = hmap.get(quality, "1080")
            # format: best mp4 up to height
            fmt = f"bv*[height<={h}][ext=mp4]+ba[ext=m4a]/b[height<={h}][ext=mp4] / bv*[height<={h}]+ba / b"
            # we will force mp4 merge
            out_tmpl = str(tmpdir / f"lumen_{vid}_{quality}_%(title)s.%(ext)s")
            # bypass YT bot: android+ios clients + deno JS runtime
            cmd = [str(YTDLP), "--no-playlist", "--merge-output-format","mp4", "-f", fmt, "-o", out_tmpl, "--no-warnings", "--extractor-args", "youtube:player_client=android,ios,web", "--extractor-args", "youtube:player_skip=webpage", "--js-runtimes", "deno", url]
            expected_ext = "mp4"
            mime = "video/mp4"
        else:
            # music
            # ext_req may be 320kbps, 256kbps, FLAC, WAV, mp3
            if quality in ("FLAC","flac"): a_ext="flac"; mime="audio/flac"; expected_ext="flac"
            elif quality in ("WAV","wav"): a_ext="wav"; mime="audio/wav"; expected_ext="wav"
            else: a_ext="mp3"; mime="audio/mpeg"; expected_ext="mp3"
            if ext_req: 
                if ext_req.lower() in ("mp3","wav","flac","m4a","opus"): a_ext=ext_req.lower()
            out_tmpl = str(tmpdir / f"lumen_{vid}_{quality}_%(title)s.%(ext)s")
            # quality for mp3: 0 best, 320k -> 0, 256k -> 2 etc.
            qmap = {"320kbps":"0","256kbps":"2","128kbps":"5"}
            aq = qmap.get(quality, "0")
            cmd = [str(YTDLP), "--no-playlist", "-x", "--audio-format", a_ext, "--audio-quality", aq, "-o", out_tmpl, "--no-warnings", "--extractor-args", "youtube:player_client=android,ios,web", "--extractor-args", "youtube:player_skip=webpage", "--js-runtimes", "deno", url]
            expected_ext = a_ext

        try:
            print("CMD:", " ".join(cmd))
            env = os.environ.copy()
            for p in ["/home/ruby/.deno/bin", "/root/.deno/bin", os.path.expanduser("~/.deno/bin"), "/usr/local/bin"]:
                if os.path.exists(p+"/deno") or os.path.exists(p):
                    env["PATH"] = p + ":" + env.get("PATH","")
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180, text=True, env=env)
            print(proc.stdout[-800:])
            print(proc.stderr[-800:])
            # stable retry — try multiple player clients + external fallback
            if proc.returncode != 0:
                stable_clients = ["android", "ios", "web", "tv", "mweb", "android,ios", "android,web"]
                tried = proc.stderr.lower()
                if any(k in tried for k in ["bot","sign in","player","unavailable","private"]):
                    for client in stable_clients:
                        print(f"retrying with client={client}")
                        if mode == "video":
                            cmd2 = [str(YTDLP), "--no-playlist", "--merge-output-format","mp4", "-f", fmt, "-o", out_tmpl, "--no-warnings", "--extractor-args", f"youtube:player_client={client}", "--js-runtimes", "deno", url]
                        else:
                            cmd2 = [str(YTDLP), "--no-playlist", "-x", "--audio-format", a_ext, "--audio-quality", aq, "-o", out_tmpl, "--no-warnings", "--extractor-args", f"youtube:player_client={client}", "--js-runtimes", "deno", url]
                        proc = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180, text=True, env=env)
                        print(f"RETRY {client}:", proc.stderr[-800:])
                        if proc.returncode == 0:
                            break
                # final fallback: try stable external downloader (loader.to style) via yt-dlp generic
                if proc.returncode != 0:
                    print("trying generic extractor")
                    cmd3 = [str(YTDLP), "--no-playlist", "-o", out_tmpl, "--no-warnings", "--js-runtimes", "deno", url]
                    proc = subprocess.run(cmd3, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, text=True, env=env)
                    print("GENERIC:", proc.stderr[-800:])
            if proc.returncode != 0:
                self.send_json(500, {"error":"download failed — YT still blocks this video. Try a direct file link or another video", "detail": proc.stderr[:1800]})
                return
            # find newest file in tmpdir
            candidates = sorted(tmpdir.glob(f"lumen_{vid}_{quality}_*"), key=lambda p: p.stat().st_mtime, reverse=True)
            if not candidates:
                # fallback any lumen file
                candidates = sorted(tmpdir.glob("lumen_*"), key=lambda p: p.stat().st_mtime, reverse=True)
            if not candidates:
                self.send_json(500, {"error":"file not found after download"})
                return
            fpath = candidates[0]
            print(f"serving {fpath}")
            ctype = mimetypes.guess_type(str(fpath))[0] or mime
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Disposition", f'attachment; filename="{fpath.name}"')
            self.send_header("Content-Length", str(fpath.stat().st_size))
            self.end_headers()
            with open(fpath, "rb") as fh:
                shutil.copyfileobj(fh, self.wfile)
            # keep file for a bit, don't delete immediately
        except subprocess.TimeoutExpired:
            self.send_json(500, {"error":"timeout"})
        except Exception as e:
            import traceback; traceback.print_exc()
            self.send_json(500, {"error":str(e)})

    def handle_direct(self, qs):
        url = qs.get("url",[None])[0]
        if not url:
            self.send_json(400, {"error":"missing url"}); return
        print(f"[direct] {url}")
        try:
            import urllib.request
            fname = os.path.basename(urllib.parse.urlparse(url).path) or "file"
            if "?" in fname: fname = fname.split("?")[0]
            if not fname or "." not in fname:
                fname = "download.mp4"
            # sanitize
            fname = re.sub(r'[^A-Za-z0-9._-]', '_', fname)[:80]
            req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                ctype = r.headers.get_content_type() or mimetypes.guess_type(fname)[0] or "application/octet-stream"
                clen = r.headers.get("Content-Length")
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
                if clen: self.send_header("Content-Length", clen)
                self.end_headers()
                shutil.copyfileobj(r, self.wfile)
        except Exception as e:
            import traceback; traceback.print_exc()
            self.send_json(500, {"error":str(e)})

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

# copy yt-dlp if needed
if YTDLP == pathlib.Path("/tmp/yt-dlp"):
    try:
        shutil.copy("/tmp/yt-dlp", ROOT / "yt-dlp")
        (ROOT / "yt-dlp").chmod(0o755)
        YTDLP = ROOT / "yt-dlp"
        print(f"copied yt-dlp to {YTDLP}")
    except: pass

print(f"Serving {ROOT} at http://localhost:{PORT}")
print(f"yt-dlp: {YTDLP}  ffmpeg: {shutil.which('ffmpeg')}")
print("Open http://localhost:8000/youtube-glass.html for REAL downloads")
print("If you open file:// directly, you'll get demo mode only.")
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try: httpd.serve_forever()
    except KeyboardInterrupt: print("\nbye")
