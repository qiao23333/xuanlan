# -*- coding: utf-8 -*-
"""把玄览的构建产物同步到个人博客的 ``public/xuanlan/``。

为什么要第二条通道
------------------
玄览原先只挂在 GitHub Pages（``qiao23333.github.io/xuanlan/``）。2026-09-17 从本机
抽样 15 次，**只有 9 次连得上（60%）**，成功的那些平均 TTFB 1.18s；同一时间同一网络
访问用户自己的博客托管（Cloudflare Pages）是 **15/15、平均 1.26s**。
也就是说：**四成的访问连页面都打不开** —— 这比首屏快几百毫秒重要得多。

个人博客（``D:/codex/个人/个人站``）是 Astro + Cloudflare Pages，push ``main`` 自动重建，
``public/`` 里的东西原样出现在站点根下。于是把它镜像到 ``public/xuanlan/`` 就得到了
同一个域名下的地址::

    https://qiao23333.github.io/xuanlan/    # 原通道（GitHub Pages）
    https://qiaozt.pages.dev/xuanlan/       # 新通道（Cloudflare Pages，绑自定义域名后跟着变）

为什么**不需要为两个通道分别构建**
----------------------------------
两个地址的应用前缀恰好都是 ``/xuanlan/``。产物里所有绝对路径就是 ``/xuanlan/...``
（``vite build --base=/xuanlan/``），``manifest.webmanifest`` 的 ``start_url``/``scope``
是 ``./``，Service Worker 也按 ``./sw.js`` 注册 —— 两边都成立。所以**一份产物两处发布**，
不存在"两份产物会漂移"的问题；但**源与博客里的副本**仍然是两处，仍然必须靠门禁守。

为什么必须走脚本 + 会失败的校验
--------------------------------
本地 ``dist/`` 是构建产物（每次构建还换哈希文件名），博客里的副本是"同一条事实的第二份存储"。
忘了同步的失败形态最恶心：**不报错、界面看着正常、只是内容过时**。所以：

* 只走这个脚本，不手抄；
* ``--check`` 提供一个**会失败**的一致性校验（逐文件逐字节，含"多余文件"）；
* ``--self-test`` 现场把门禁弄坏三次，证明它真的会红（不会失败的门禁等于没有门禁）。

用法::

    python tools/sync-to-blog.py --self-test  # 先证明门禁有效（不碰博客）
    python tools/sync-to-blog.py             # 同步（博客目录不在就报错退出）
    python tools/sync-to-blog.py --check     # 只校验；博客目录缺失时**跳过**并退出 0

环境变量 ``XUANLAN_BLOG_DIR`` 可覆盖目标目录（换机器 / 换博客路径时用）。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
#: 源 = 构建产物。必须是用 `npm run build:pages`（--base=/xuanlan/）产出的那一份。
_SRC = _ROOT / "dist"

#: 博客里的目标目录。默认是本机那份个人站仓库；可用环境变量覆盖。
_DEFAULT_BLOG_DIR = Path(r"D:/codex/个人/个人站/public/xuanlan")

#: 记录源版本的小文件，随站点一起发布（只含事实：仓库、提交号、日期、每个文件的哈希）。
_MANIFEST = ".xuanlan-source.json"


def _blog_dir() -> Path:
    import os

    override = os.environ.get("XUANLAN_BLOG_DIR")
    return Path(override) if override else _DEFAULT_BLOG_DIR


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def _source_files(src: Path) -> dict[str, Path]:
    return {
        p.relative_to(src).as_posix(): p
        for p in sorted(src.rglob("*"))
        if p.is_file() and p.name != _MANIFEST
    }


def _git_sha() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_ROOT, capture_output=True, text=True, timeout=10,
        )
        return out.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def _diff(src: dict[str, Path], dst: Path) -> tuple[list[str], list[str], list[str]]:
    """返回 (缺失, 内容不同, 多余) 三份相对路径清单。"""
    missing, changed, extra = [], [], []
    for rel, sp in src.items():
        dp = dst / rel
        if not dp.is_file():
            missing.append(rel)
        elif dp.read_bytes() != sp.read_bytes():
            changed.append(rel)
    if dst.is_dir():
        for dp in sorted(dst.rglob("*")):
            if dp.is_file():
                rel = dp.relative_to(dst).as_posix()
                if rel == _MANIFEST:
                    continue
                if rel not in src:
                    extra.append(rel)
    return missing, changed, extra


def _preflight(src: Path) -> str | None:
    """产物体检：宁可拒绝同步，也别把"能打开但功能全无"的产物发上去。

    最典型的两种坏产物：
      ① 忘了构建 —— 目录不存在；
      ② 用了 `vite build`（默认 base=/）而不是 `npm run build:pages` ——
         产物里引用 `/assets/...`，挂到 `/xuanlan/` 下必 404，
         而**首页照样 200**，看起来只是"样式丢了"，很难第一时间怀疑到 base。
    """
    index = src / "index.html"
    if not src.is_dir() or not index.is_file():
        return f"产物不存在：{index}（先跑 npm run build:pages）"
    html = index.read_text(encoding="utf-8", errors="ignore")
    if "/xuanlan/assets/" not in html:
        return ("index.html 里找不到 /xuanlan/assets/ —— 这份产物多半是用默认 base 构建的，"
                "挂到 /xuanlan/ 下所有资源都会 404。请用 npm run build:pages 重新构建")
    return None


def _self_test() -> int:
    """把门禁弄坏三次，确认它每次都报红。不碰博客，只在项目内建临时目录。"""
    tmp = _ROOT / ".tmp-sync-selftest"
    fake_src = tmp / "src"
    fake_src.mkdir(parents=True, exist_ok=True)
    (fake_src / "index.html").write_text("<html>/xuanlan/assets/a.js</html>", encoding="utf-8")
    (fake_src / "assets" / "a.js").parent.mkdir(parents=True, exist_ok=True)
    (fake_src / "assets" / "a.js").write_text("console.log(1)\n", encoding="utf-8")

    fails = 0

    def case(i: int, name: str, mutate, want: str) -> None:
        """每个用例一个**全新的**目标目录。

        踩过：第一版所有用例共用一个 dst，于是上一用例塞进去的"多余文件"留到了下一用例，
        "副本与源一致"这一条被判成"多余" —— **测试自己把测试搞错了**。
        共享状态是这类"给门禁做反向测试"最容易踩的坑。
        """
        nonlocal fails
        fake_dst = tmp / f"dst{i}"
        shutil.copytree(fake_src, fake_dst, dirs_exist_ok=True)
        mutate(fake_dst)
        missing, changed, extra = _diff(_source_files(fake_src), fake_dst)
        got = "缺失" if missing else "内容不同" if changed else "多余" if extra else "一致"
        ok = got == want
        print(f"  {'✔' if ok else '✖'} {name}：期望判「{want}」，实际判「{got}」")
        if not ok:
            fails += 1

    print("门禁反向测试（每一条都必须判红）：")
    case(0, "副本少了文件", lambda d: (d / "assets" / "a.js").unlink(), "缺失")
    case(1, "副本内容被改", lambda d: (d / "assets" / "a.js").write_text("x\n", encoding="utf-8"), "内容不同")
    case(2, "副本多了文件", lambda d: (d / "stale.js").write_text("old\n", encoding="utf-8"), "多余")
    case(3, "副本与源一致", lambda d: None, "一致")

    # 产物体检也要能失败
    bad = tmp / "bad"
    bad.mkdir(parents=True, exist_ok=True)
    (bad / "index.html").write_text('<script src="/assets/a.js"></script>', encoding="utf-8")
    why = _preflight(bad)
    ok = why is not None and "build:pages" in why
    print(f"  {'✔' if ok else '✖'} 产物用了默认 base：期望被拒绝，实际{'拒绝' if why else '放过'}")
    if not ok:
        fails += 1

    print(f"\n{'✅ 门禁有效：4 条判据全部按预期失败/通过' if not fails else f'❌ 有 {fails} 条判据没按预期工作'}")
    return 1 if fails else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="同步玄览构建产物到个人博客")
    ap.add_argument("--check", action="store_true", help="只校验副本与源是否一致，不写入")
    ap.add_argument("--self-test", action="store_true", help="反向测试门禁自身，不碰博客")
    args = ap.parse_args()

    if args.self_test:
        return _self_test()

    dst = _blog_dir()

    problem = _preflight(_SRC)
    if problem:
        print(f"!! {problem}", file=sys.stderr)
        return 1

    src = _source_files(_SRC)
    total_kb = sum(p.stat().st_size for p in src.values()) // 1024
    print(f"源   : {_SRC.name}/  ({len(src)} 个文件 / {total_kb} KB)")
    print(f"目标 : {dst}")

    # 博客仓库不在这台机器上（换机器 / CI）属于**环境缺失**，不是不一致。
    # 这时候 --check 跳过而不是判失败 —— 否则 CI 会天天红，红习惯之后真不一致就没人看了。
    if not dst.parent.is_dir():
        msg = f"博客 public 目录不存在（{dst.parent}）"
        if args.check:
            print(f"跳过：{msg} —— 环境缺失，不是一致性错误")
            return 0
        print(f"!! {msg}；可用 XUANLAN_BLOG_DIR 指定目标", file=sys.stderr)
        return 1

    missing, changed, extra = _diff(src, dst)

    if args.check:
        if not missing and not changed and not extra:
            print(f"OK：副本与源一致（{len(src)} 个文件）")
            return 0
        print("!! 不一致：", file=sys.stderr)
        for tag, items in (("缺失", missing), ("内容不同", changed), ("多余", extra)):
            for rel in items:
                print(f"   {tag}: {rel}", file=sys.stderr)
        print("\n   跑 python tools/sync-to-blog.py 同步", file=sys.stderr)
        return 1

    for rel in missing + changed:
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src[rel], target)
    for rel in extra:
        (dst / rel).unlink()
        # 顺手清掉空目录，避免博客仓库里留一堆空壳
        for parent in (dst / rel).parents:
            if parent != dst and parent.is_dir() and not any(parent.iterdir()):
                parent.rmdir()
            else:
                break

    manifest = {
        "source": "qiao23333/xuanlan",
        "commit": _git_sha(),
        "synced_at": date.today().isoformat(),
        "channel": "cloudflare-pages (博客 /xuanlan/)",
        "files": {rel: _sha256(dst / rel) for rel in src},
    }
    (dst / _MANIFEST).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"已同步：新增 {len(missing)} / 更新 {len(changed)} / 删除 {len(extra)}")
    print(f"源版本：{manifest['commit']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
