"""Extract the static site from the actual OCI image; never rebuild for publication."""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tarfile
import time

ARTIFACTS = Path(".ci/artifacts")
LAYOUT = Path(".ci/image")
DIGEST_PATTERN = re.compile(r"sha256:[0-9a-f]{64}")


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def blob(descriptor):
    identity = descriptor["digest"]
    if not DIGEST_PATTERN.fullmatch(identity):
        raise ValueError("Unsupported OCI digest")
    data = (LAYOUT / "blobs" / "sha256" / identity.split(":")[1]).read_bytes()
    if digest(data) != identity or len(data) != descriptor["size"]:
        raise ValueError("OCI blob integrity mismatch")
    return data


def runtime_manifest(descriptor):
    manifest = json.loads(blob(descriptor))
    if "manifests" in manifest:
        for child in manifest["manifests"]:
            platform = child.get("platform", {})
            if platform.get("os") == "linux" and platform.get("architecture") == "amd64":
                return runtime_manifest(child)
        raise ValueError("Missing linux/amd64 image")
    config = json.loads(blob(manifest["config"]))
    if config.get("os") != "linux" or config.get("architecture") != "amd64":
        raise ValueError("Unexpected runtime image platform")
    return manifest


def prepare(verify_only=False):
    expected = os.environ["EXPECTED_IMAGE_DIGEST"]
    if not DIGEST_PATTERN.fullmatch(expected):
        raise ValueError("Missing or malformed expected image digest")
    LAYOUT.mkdir(parents=True, exist_ok=True)
    with tarfile.open(ARTIFACTS / "image.oci.tar", "r:*") as archive:
        for entry in archive:
            name = entry.name.removeprefix("./")
            if entry.isdir():
                continue
            if not entry.isfile() or not (name in {"index.json", "oci-layout"} or re.fullmatch(r"blobs/sha256/[0-9a-f]{64}", name)):
                raise ValueError("Unexpected file in OCI archive")
            target = LAYOUT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(entry) as source, target.open("wb") as destination:
                shutil.copyfileobj(source, destination)
            if name.startswith("blobs/") and digest(target.read_bytes()) != "sha256:" + target.name:
                raise ValueError("OCI archive contains an invalid blob")
    index = json.loads((LAYOUT / "index.json").read_text())
    matches = [entry for entry in index["manifests"] if entry["digest"] == expected]
    if len(matches) != 1:
        raise ValueError("OCI archive does not match the BuildKit output digest")
    manifest = runtime_manifest(matches[0])
    if verify_only:
        return
    statements = []
    subject_index = json.loads(blob(matches[0]))
    for descriptor in subject_index.get("manifests", []):
        if descriptor.get("annotations", {}).get("vnd.docker.reference.type") != "attestation-manifest":
            continue
        attachment = json.loads(blob(descriptor))
        for layer in attachment.get("layers", []):
            statement = json.loads(blob(layer))
            if "predicateType" in statement:
                statements.append(statement)
    (ARTIFACTS / "buildkit-statements.json").write_text(json.dumps(statements, indent=2) + "\n")
    public = Path(".ci/site")
    public.mkdir(parents=True, exist_ok=True)
    for layer in manifest["layers"]:
        with tarfile.open(fileobj=io.BytesIO(blob(layer)), mode="r:*") as archive:
            for entry in archive:
                name = entry.name.removeprefix("./")
                if not name.startswith("app/public/"):
                    continue
                relative = PurePosixPath(name.removeprefix("app/public/"))
                if ".." in relative.parts or relative.is_absolute():
                    raise ValueError("Invalid site path in image")
                target = public.joinpath(*relative.parts)
                if relative.name == ".wh..wh..opq":
                    if target.parent.exists():
                        for child in target.parent.iterdir():
                            shutil.rmtree(child) if child.is_dir() else child.unlink()
                    continue
                if relative.name.startswith(".wh."):
                    removed = target.with_name(relative.name[4:])
                    if removed.exists():
                        shutil.rmtree(removed) if removed.is_dir() else removed.unlink()
                    continue
                if entry.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                elif entry.isfile():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(entry) as source, target.open("wb") as destination:
                        shutil.copyfileobj(source, destination)
                else:
                    raise ValueError("Static site must not contain links or device files")
    if not (public / "index.html").is_file() or not (public / ".well-known/security.txt").is_file():
        raise ValueError("Compiled static site is incomplete")
    epoch = int(os.environ.get("SOURCE_DATE_EPOCH", "0"))
    with tarfile.open(ARTIFACTS / "stanelabs-web.tar", "w", format=tarfile.PAX_FORMAT) as archive:
        for target in sorted(public.rglob("*")):
            info = archive.gettarinfo(str(target), arcname=target.relative_to(public).as_posix())
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            info.mtime = epoch
            info.mode = 0o755 if info.isdir() else 0o644
            if info.isfile():
                with target.open("rb") as content:
                    archive.addfile(info, content)
            else:
                archive.addfile(info)
    (ARTIFACTS / "image-digest.txt").write_text(expected + "\n")
    build_info = {
        "schemaVersion": 1,
        "imageDigest": expected,
        "platform": "linux/amd64",
        "repository": os.environ.get("GITHUB_REPOSITORY"),
        "sourceCommit": os.environ.get("GITHUB_SHA"),
        "sourceRef": os.environ.get("GITHUB_REF"),
        "runId": os.environ.get("GITHUB_RUN_ID"),
        "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "sourceDateEpoch": epoch,
        "generatedAtUnix": int(time.time()),
        "inputs": {name: digest(Path(name).read_bytes()) for name in ["package-lock.json", "Dockerfile", "scripts/ci/tools.lock.json", "scripts/ci/images.lock.json", "scripts/ci/actions.lock.json"]},
        "images": json.loads(Path("scripts/ci/images.lock.json").read_text()),
        "tools": json.loads(Path("scripts/ci/tools.lock.json").read_text()),
        "staticSite": "stanelabs-web.tar contains /app/public from this image; the contact API needs the NestJS runtime image.",
    }
    (ARTIFACTS / "build-info.json").write_text(json.dumps(build_info, indent=2) + "\n")


if __name__ == "__main__":
    prepare(verify_only="--verify-only" in sys.argv)
