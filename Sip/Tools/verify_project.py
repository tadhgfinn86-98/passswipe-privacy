#!/usr/bin/env python3
"""Parses Sip.xcodeproj/project.pbxproj and checks it hangs together.

An independent reader (it does not import the generator) so that a mistake in
the generator shows up here rather than in Xcode. Checks:
  * the file is valid OpenStep plist and round-trips into a dict
  * every referenced object id exists
  * every PBXFileReference in a build phase points at a file on disk
  * each target has the phases and product type it should
"""
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PBXPROJ = os.path.join(ROOT, "Sip.xcodeproj", "project.pbxproj")


class Parser:
    def __init__(self, text):
        self.text = text
        self.pos = 0

    def error(self, message):
        line = self.text.count("\n", 0, self.pos) + 1
        raise SyntaxError("%s at line %d" % (message, line))

    def skip(self):
        while self.pos < len(self.text):
            char = self.text[self.pos]
            if char in " \t\n\r":
                self.pos += 1
            elif self.text.startswith("//", self.pos):
                end = self.text.find("\n", self.pos)
                self.pos = len(self.text) if end == -1 else end
            elif self.text.startswith("/*", self.pos):
                end = self.text.find("*/", self.pos)
                if end == -1:
                    self.error("unterminated comment")
                self.pos = end + 2
            else:
                return

    def parse(self):
        self.skip()
        value = self.parse_value()
        self.skip()
        if self.pos != len(self.text):
            self.error("trailing content")
        return value

    def parse_value(self):
        self.skip()
        if self.pos >= len(self.text):
            self.error("unexpected end")
        char = self.text[self.pos]
        if char == "{":
            return self.parse_dict()
        if char == "(":
            return self.parse_array()
        if char == '"':
            return self.parse_quoted()
        return self.parse_bare()

    def parse_dict(self):
        self.pos += 1
        result = {}
        while True:
            self.skip()
            if self.pos >= len(self.text):
                self.error("unterminated dict")
            if self.text[self.pos] == "}":
                self.pos += 1
                return result
            key = self.parse_value()
            self.skip()
            if self.text[self.pos] != "=":
                self.error("expected = after key %r" % key)
            self.pos += 1
            value = self.parse_value()
            self.skip()
            if self.text[self.pos] != ";":
                self.error("expected ; after value for %r" % key)
            self.pos += 1
            result[key] = value

    def parse_array(self):
        self.pos += 1
        result = []
        while True:
            self.skip()
            if self.pos >= len(self.text):
                self.error("unterminated array")
            if self.text[self.pos] == ")":
                self.pos += 1
                return result
            result.append(self.parse_value())
            self.skip()
            if self.text[self.pos] == ",":
                self.pos += 1

    def parse_quoted(self):
        self.pos += 1
        chars = []
        while True:
            if self.pos >= len(self.text):
                self.error("unterminated string")
            char = self.text[self.pos]
            if char == "\\":
                chars.append(self.text[self.pos + 1])
                self.pos += 2
                continue
            if char == '"':
                self.pos += 1
                return "".join(chars)
            chars.append(char)
            self.pos += 1

    def parse_bare(self):
        start = self.pos
        while self.pos < len(self.text) and self.text[self.pos] not in " \t\n\r=;,(){}\"":
            self.pos += 1
        if start == self.pos:
            self.error("empty token")
        return self.text[start:self.pos]


def main():
    with open(PBXPROJ) as handle:
        text = handle.read()

    root = Parser(text).parse()
    objects = root["objects"]
    problems = []

    def check(condition, message):
        if not condition:
            problems.append(message)

    check(root["objectVersion"] == "56", "unexpected objectVersion %s" % root.get("objectVersion"))
    check(root["rootObject"] in objects, "rootObject missing from objects")

    # Every id-looking value resolves.
    def walk(node):
        if isinstance(node, dict):
            for key, item in node.items():
                walk(item)
        elif isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, str) and len(node) == 24 and node.startswith("51"):
            check(node in objects, "dangling reference %s" % node)

    walk(objects)

    # File references point at real files.
    for object_id, node in objects.items():
        if node.get("isa") != "PBXFileReference":
            continue
        if node.get("sourceTree") == "BUILT_PRODUCTS_DIR":
            continue
        name = node["path"]
        matches = [os.path.join(base, name)
                   for base, _, files in os.walk(ROOT)
                   if name in files or name in os.listdir(base)]
        check(bool(matches), "file reference %s (%s) not found on disk" % (name, object_id))

    project = objects[root["rootObject"]]
    targets = {objects[t]["name"]: objects[t] for t in project["targets"]}
    check(set(targets) == {"Sip", "SipWidgetExtension", "SipTests"},
          "unexpected targets: %s" % sorted(targets))

    expected_types = {
        "Sip": "com.apple.product-type.application",
        "SipWidgetExtension": "com.apple.product-type.app-extension",
        "SipTests": "com.apple.product-type.bundle.unit-test",
    }
    for name, target in targets.items():
        check(target["productType"] == expected_types[name],
              "%s has product type %s" % (name, target["productType"]))
        phases = [objects[p]["isa"] for p in target["buildPhases"]]
        check("PBXSourcesBuildPhase" in phases, "%s has no sources phase" % name)

        sources = [p for p in target["buildPhases"] if objects[p]["isa"] == "PBXSourcesBuildPhase"][0]
        files = objects[sources]["files"]
        check(len(files) > 0, "%s compiles nothing" % name)
        names = sorted(objects[objects[f]["fileRef"]]["path"] for f in files)
        print("  %-20s %2d sources: %s" % (name, len(names), ", ".join(names)))

    app = targets["Sip"]
    embed = [p for p in app["buildPhases"] if objects[p]["isa"] == "PBXCopyFilesBuildPhase"]
    check(len(embed) == 1, "app target should embed the widget extension")
    if embed:
        check(objects[embed[0]]["dstSubfolderSpec"] == "13", "embed phase must target PlugIns (13)")
    check(len(app["dependencies"]) == 1, "app should depend on the widget extension")

    tests = targets["SipTests"]
    test_settings = objects[objects[tests["buildConfigurationList"]]["buildConfigurations"][0]]["buildSettings"]
    check("Sip.app" in test_settings.get("TEST_HOST", ""), "tests are not hosted by the app")

    print("\n%d objects parsed" % len(objects))
    if problems:
        for problem in problems:
            print("  PROBLEM: %s" % problem)
        return 1
    print("project.pbxproj looks structurally sound")
    return 0


if __name__ == "__main__":
    sys.exit(main())
