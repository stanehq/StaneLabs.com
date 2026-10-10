"""Exercise artifact extraction using real OCI blobs, manifests and tar layers."""
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("prepare-artifacts.py")
SPEC = importlib.util.spec_from_file_location("prepare_artifacts", MODULE_PATH)
ARTIFACT_MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ARTIFACT_MODULE)


def json_bytes(value):
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


def tar_bytes(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as archive:
        for name, content in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mtime = 123456
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()


class ArtifactExtractionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="stanelabs-oci-test-")
        self.addCleanup(temporary.cleanup)
        previous_cwd = Path.cwd()
        self.addCleanup(os.chdir, previous_cwd)
        os.chdir(temporary.name)
        self.root = Path.cwd()
        Path(".ci/artifacts").mkdir(parents=True)
        Path("scripts/ci").mkdir(parents=True)
        for name, content in {
            "package-lock.json": '{"lockfileVersion":3,"packages":{}}',
            "Dockerfile": "FROM scratch\n",
            "scripts/ci/tools.lock.json": '{"tools":[]}',
            "scripts/ci/images.lock.json": '{"images":{}}',
            "scripts/ci/actions.lock.json": '{"actions":{}}',
        }.items():
            Path(name).write_text(content, encoding="utf-8")
        environment = patch.dict(os.environ, {
            "EXPECTED_IMAGE_DIGEST": "sha256:" + "0" * 64,
            "SOURCE_DATE_EPOCH": "1700000000",
            "GITHUB_REPOSITORY": "example/stanelabs",
            "GITHUB_SHA": "a" * 40,
            "GITHUB_REF": "refs/heads/main",
        })
        environment.start()
        self.addCleanup(environment.stop)

    def make_image(self, extra_public_files=None, corrupt_layer=False):
        self.site_files = {
            "index.html": b"<!doctype html><title>StaneLabs fixture</title>",
            ".well-known/security.txt": b"Contact: mailto:security@stanelabs.com\n",
        }
        layer_files = {"app/public/" + name: value for name, value in self.site_files.items()}
        layer_files.update(extra_public_files or {})
        layer = tar_bytes(layer_files)
        blobs = {}

        def add_blob(data, media_type, platform=None):
            identity = ARTIFACT_MODULE.digest(data)
            blobs["blobs/sha256/" + identity.split(":", 1)[1]] = data
            descriptor = {"mediaType": media_type, "digest": identity, "size": len(data)}
            if platform:
                descriptor["platform"] = platform
            return descriptor

        layer_descriptor = add_blob(layer, "application/vnd.oci.image.layer.v1.tar")
        config = add_blob(json_bytes({
            "os": "linux", "architecture": "amd64",
            "rootfs": {"type": "layers", "diff_ids": [ARTIFACT_MODULE.digest(layer)]},
        }), "application/vnd.oci.image.config.v1+json")
        manifest = add_blob(json_bytes({
            "schemaVersion": 2,
            "mediaType": "application/vnd.oci.image.manifest.v1+json",
            "config": config, "layers": [layer_descriptor],
        }), "application/vnd.oci.image.manifest.v1+json", {"os": "linux", "architecture": "amd64"})
        image_index = add_blob(json_bytes({
            "schemaVersion": 2,
            "mediaType": "application/vnd.oci.image.index.v1+json",
            "manifests": [manifest],
        }), "application/vnd.oci.image.index.v1+json")
        if corrupt_layer:
            layer_name = "blobs/sha256/" + layer_descriptor["digest"].split(":", 1)[1]
            blobs[layer_name] = layer + b"tampered"
        files = {
            "oci-layout": json_bytes({"imageLayoutVersion": "1.0.0"}),
            "index.json": json_bytes({"schemaVersion": 2, "manifests": [image_index]}),
            **blobs,
        }
        Path(".ci/artifacts/image.oci.tar").write_bytes(tar_bytes(files))
        self.image_digest = image_index["digest"]
        os.environ["EXPECTED_IMAGE_DIGEST"] = self.image_digest

    def test_extracts_site_from_the_digest_matched_runtime_image(self):
        self.make_image()
        ARTIFACT_MODULE.prepare()
        with tarfile.open(".ci/artifacts/stanelabs-web.tar") as archive:
            for name, expected_bytes in self.site_files.items():
                member = archive.getmember(name)
                self.assertEqual(archive.extractfile(member).read(), expected_bytes)
                self.assertEqual((member.uid, member.gid, member.mtime, member.mode),
                                 (0, 0, 1700000000, 0o644))
        self.assertEqual(Path(".ci/artifacts/image-digest.txt").read_text().strip(), self.image_digest)
        build_info = json.loads(Path(".ci/artifacts/build-info.json").read_text())
        self.assertEqual(build_info["imageDigest"], self.image_digest)
        self.assertEqual(build_info["sourceCommit"], "a" * 40)
        self.assertEqual(build_info["inputs"]["Dockerfile"],
                         ARTIFACT_MODULE.digest(Path("Dockerfile").read_bytes()))

    def test_rejects_a_blob_whose_bytes_do_not_match_its_digest(self):
        self.make_image(corrupt_layer=True)
        with self.assertRaisesRegex(ValueError, "invalid blob"):
            ARTIFACT_MODULE.prepare()
        self.assertFalse(Path(".ci/artifacts/stanelabs-web.tar").exists())

    def test_rejects_an_index_unrelated_to_the_buildkit_digest(self):
        self.make_image()
        os.environ["EXPECTED_IMAGE_DIGEST"] = "sha256:" + "f" * 64
        with self.assertRaisesRegex(ValueError, "BuildKit output digest"):
            ARTIFACT_MODULE.prepare()
        self.assertFalse(Path(".ci/artifacts/stanelabs-web.tar").exists())

    def test_rejects_public_path_traversal_before_writing_outside_site(self):
        self.make_image({"app/public/../../escaped.txt": b"must never be written"})
        with self.assertRaisesRegex(ValueError, "Invalid site path"):
            ARTIFACT_MODULE.prepare()
        self.assertFalse(Path("escaped.txt").exists())
        self.assertFalse(Path(".ci/escaped.txt").exists())
        self.assertFalse(Path(".ci/artifacts/stanelabs-web.tar").exists())


if __name__ == "__main__":
    unittest.main()
