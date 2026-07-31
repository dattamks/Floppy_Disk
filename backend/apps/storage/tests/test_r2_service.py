"""R2StorageService against a fake boto3 S3 client (no network, no moto dep).

These lock in the S3 API contract the app relies on: a presigned POST that
enforces the reserved size, presigned GET for downloads, multipart lifecycle,
server-side copy, delete, and the server-side byte helpers (save/read/stat) that
notes, inline edits, and content indexing use.
"""
import hashlib

import pytest
from botocore.exceptions import ClientError
from django.test import override_settings

from apps.storage.services.r2 import R2StorageService


class FakeS3:
    """Minimal in-memory stand-in for a boto3 S3 client."""

    def __init__(self):
        self.objects = {}  # (bucket, key) -> bytes
        self.multipart = {}
        self.calls = []
        self._mpu_seq = 0

    # -- presign --
    def generate_presigned_post(self, *, Bucket, Key, Fields, Conditions, ExpiresIn):
        self.calls.append(("post", Bucket, Key, Conditions))
        return {"url": f"https://r2.example/{Bucket}", "fields": {**Fields, "key": Key}}

    def generate_presigned_url(self, op, *, Params, ExpiresIn):
        self.calls.append((op, Params["Bucket"], Params["Key"], ExpiresIn))
        return f"https://r2.example/{Params['Bucket']}/{Params['Key']}?sig=1&exp={ExpiresIn}"

    # -- multipart --
    def create_multipart_upload(self, *, Bucket, Key):
        self._mpu_seq += 1
        uid = f"mpu-{self._mpu_seq}"
        self.multipart[uid] = (Bucket, Key)
        return {"UploadId": uid}

    def complete_multipart_upload(self, *, Bucket, Key, UploadId, MultipartUpload):
        self.calls.append(("complete", Bucket, Key, UploadId))

    def abort_multipart_upload(self, *, Bucket, Key, UploadId):
        self.multipart.pop(UploadId, None)
        self.calls.append(("abort", Bucket, Key, UploadId))

    def list_multipart_uploads(self, *, Bucket):
        return {"Uploads": []}

    # -- object ops --
    def copy_object(self, *, Bucket, Key, CopySource):
        src = self.objects[(CopySource["Bucket"], CopySource["Key"])]
        self.objects[(Bucket, Key)] = src

    def delete_object(self, *, Bucket, Key):
        self.objects.pop((Bucket, Key), None)

    def put_object(self, *, Bucket, Key, Body):
        self.objects[(Bucket, Key)] = Body

    def get_object(self, *, Bucket, Key):
        import io

        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def head_object(self, *, Bucket, Key):
        try:
            data = self.objects[(Bucket, Key)]
        except KeyError:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        etag = hashlib.md5(data).hexdigest()  # noqa: S324 - matches S3 single-part ETag
        return {"ContentLength": len(data), "ETag": f'"{etag}"'}


@pytest.fixture
def svc():
    s = R2StorageService()
    s._client = FakeS3()  # cached_property override - no real boto3 client
    return s


R2_ENV = dict(
    R2_ENDPOINT_URL="https://acct.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID="ak",
    R2_SECRET_ACCESS_KEY="sk",
    R2_BUCKET="floppy-bucket",
    R2_REGION_BUCKETS={},
)


@override_settings(**R2_ENV)
def test_single_bucket_resolves_every_region(svc):
    assert svc._bucket_for("ap-south") == "floppy-bucket"
    assert svc._bucket_for("anything") == "floppy-bucket"


@override_settings(R2_REGION_BUCKETS={"eu": "eu-bkt"}, R2_BUCKET="default-bkt",
                   R2_ENDPOINT_URL="x", R2_ACCESS_KEY_ID="a", R2_SECRET_ACCESS_KEY="s")
def test_region_map_wins_with_single_bucket_fallback(svc):
    assert svc._bucket_for("eu") == "eu-bkt"       # explicit mapping
    assert svc._bucket_for("us") == "default-bkt"  # falls back to the single bucket


@override_settings(R2_REGION_BUCKETS={}, R2_BUCKET="", R2_ENDPOINT_URL="x",
                   R2_ACCESS_KEY_ID="a", R2_SECRET_ACCESS_KEY="s")
def test_missing_bucket_raises(svc):
    with pytest.raises(ValueError):
        svc._bucket_for("ap-south")


@override_settings(**R2_ENV)
def test_presign_upload_enforces_size_limit(svc):
    up = svc.presign_upload(region="ap-south", object_key="u1/f1", max_bytes=1234)
    # The content-length-range condition is what stops an over-quota upload.
    conds = svc._client.calls[-1][3]
    assert ["content-length-range", 0, 1234] in conds
    assert up.object_key == "u1/f1"


@override_settings(**R2_ENV)
def test_presign_download_targets_the_key(svc):
    url = svc.presign_download(region="ap-south", object_key="u1/f1", expires_in=900)
    assert "floppy-bucket" in url and "u1/f1" in url and "900" in url


@override_settings(**R2_ENV)
def test_save_read_and_stat_roundtrip(svc):
    data = b"hello notes"
    svc.save_bytes(region="ap-south", object_key="u1/note", data=data)
    assert svc.read_bytes(region="ap-south", object_key="u1/note") == data
    size, content_hash = svc.stat(region="ap-south", object_key="u1/note")
    assert size == len(data)
    assert content_hash == hashlib.md5(data).hexdigest()  # noqa: S324


@override_settings(**R2_ENV)
def test_stat_missing_object_raises_filenotfound(svc):
    with pytest.raises(FileNotFoundError):
        svc.stat(region="ap-south", object_key="nope")


@override_settings(**R2_ENV)
def test_copy_and_delete(svc):
    svc.save_bytes(region="ap-south", object_key="src", data=b"x")
    svc.copy_object(src_region="ap-south", dst_region="ap-south", src_key="src", dst_key="dst")
    assert svc.read_bytes(region="ap-south", object_key="dst") == b"x"
    svc.delete_object(region="ap-south", object_key="dst")
    with pytest.raises(KeyError):
        svc.read_bytes(region="ap-south", object_key="dst")


@override_settings(**R2_ENV)
def test_multipart_lifecycle(svc):
    uid = svc.create_multipart(region="ap-south", object_key="big")
    assert uid
    svc.complete_multipart(region="ap-south", object_key="big", upload_id=uid,
                           parts=[{"ETag": "e", "PartNumber": 1}])
    svc.abort_multipart(region="ap-south", object_key="big", upload_id=uid)
    assert svc.list_incomplete_multipart(region="ap-south") == []
