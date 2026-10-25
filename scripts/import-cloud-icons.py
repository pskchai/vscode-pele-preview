"""Import provider SVG archives. Normal builds use the saved JSON files."""

import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "cloud-icons"
SVG = "{http://www.w3.org/2000/svg}"
ET.register_namespace("", SVG[1:-1])
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def prepare_svg(data):
    root = ET.fromstring(data)
    # The Azure V24 Foundry Control Plane SVG uses xviewBox instead of viewBox.
    if "viewBox" not in root.attrib and "xviewBox" in root.attrib:
        root.set("viewBox", root.attrib.pop("xviewBox"))
    if root.tag != SVG + "svg" or "viewBox" not in root.attrib:
        raise ValueError("The icon must be an SVG with a viewBox.")

    # Put class styles on each element so icons cannot change each other's colors.
    styles = {}
    for parent in root.iter():
        for element in list(parent):
            if element.tag != SVG + "style":
                continue
            for selectors, declarations in re.findall(
                r"([^{}]+)\{([^{}]*)\}", element.text or ""
            ):
                for selector in selectors.split(","):
                    selector = selector.strip()
                    if not re.fullmatch(r"\.[\w-]+", selector):
                        raise ValueError(f"Unsupported SVG selector: {selector}")
                    styles[selector[1:]] = (
                        styles.get(selector[1:], "") + declarations.strip() + ";"
                    )
            parent.remove(element)
    for element in root.iter():
        classes = element.attrib.pop("class", "").split()
        declarations = "".join(styles.get(name, "") for name in classes)
        if declarations:
            element.set("style", declarations + element.get("style", ""))
    return ET.tostring(root, encoding="unicode")


def main():
    archive_directory = Path(sys.argv[1])
    sources = json.loads((OUTPUT / "sources.json").read_text())
    packs = {prefix: {"icons": {}, "aliases": {}} for prefix in ("aws", "azure", "gcp")}

    for source in sources["archives"]:
        data = (archive_directory / (source["id"] + ".zip")).read_bytes()
        if hashlib.sha256(data).hexdigest() != source["sha256"]:
            raise ValueError(f"Archive checksum mismatch: {source['id']}")
        pack = packs[source["provider"]]
        with zipfile.ZipFile(archive_directory / (source["id"] + ".zip")) as archive:
            files = [
                name
                for name in archive.namelist()
                if name.endswith(".svg") and not name.startswith("__MACOSX/")
            ]

            # Use the largest AWS SVG when the archive has several sizes.
            def order(name):
                size = re.search(r"_(16|32|48|64)(?:_|\.svg$)", name)
                return (int(size[1]) if size else 0, name)

            for filename in sorted(files, key=order):
                path = Path(filename)
                if source["provider"] == "aws":
                    name = slug(re.sub(r"_(16|32|48|64)(?=_|$)", "", path.stem))
                    short = re.sub(r"^(?:arch|res)-(?:amazon|aws)-", "", name)
                elif source["provider"] == "azure":
                    name = slug(path.stem)
                    short = re.sub(r"^\d+-icon-service-", "", name)
                elif source["id"] == "gcp-legacy":
                    name = short = slug(path.stem)
                else:
                    name = short = slug(path.parts[1])
                    if source["id"] == "gcp-categories":
                        name = short = "category-" + name
                pack["icons"][name] = prepare_svg(archive.read(filename))
                if short != name:
                    pack["aliases"][short] = name

    # Keep existing GCP names when the provider uses a new product name.
    packs["gcp"]["aliases"].update(
        {
            "google-kubernetes-engine": "gke",
            "vertexai": "vertex-ai",
        }
    )
    for prefix, pack in packs.items():
        for target in pack["aliases"].values():
            if target not in pack["icons"]:
                raise ValueError(f"Missing alias target: {prefix}:{target}")
        ordered = {key: dict(sorted(values.items())) for key, values in pack.items()}
        (OUTPUT / f"{prefix}.json").write_text(
            json.dumps(ordered, separators=(",", ":")) + "\n"
        )
        print(
            f"{prefix}: {len(pack['icons'])} provider SVGs, {len(pack['aliases'])} aliases"
        )


if __name__ == "__main__":
    main()
