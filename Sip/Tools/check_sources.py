#!/usr/bin/env python3
"""Sanity checks over the Swift sources that don't need a compiler.

  * balanced braces / parens / brackets outside strings and comments
  * every project-defined type a target uses is actually compiled into that
    target (easy to get wrong: the widget extension only shares four files)
"""
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

TARGETS = {
    "Sip": [
        "Sip/Core/DayKey.swift", "Sip/Core/Drink.swift", "Sip/Core/DrinkStore.swift",
        "Sip/Core/SipShared.swift", "Sip/Core/SipSettings.swift",
        "Sip/Core/SipEnvironment.swift", "Sip/Core/Haptics.swift",
        "Sip/Intents/AddDrinkIntent.swift", "Sip/Intents/DrinkCountSnippet.swift",
        "Sip/Intents/SipShortcuts.swift",
        "Sip/App/ActionButtonGuideView.swift", "Sip/App/DataExport.swift",
        "Sip/App/DrinkCardView.swift", "Sip/App/HistoryView.swift",
        "Sip/App/OnboardingView.swift", "Sip/App/RootView.swift",
        "Sip/App/SettingsView.swift", "Sip/App/SipApp.swift",
        "Sip/App/Theme.swift", "Sip/App/TodayView.swift",
    ],
    "SipWidgetExtension": [
        "Sip/Core/DayKey.swift", "Sip/Core/Drink.swift", "Sip/Core/DrinkStore.swift",
        "Sip/Core/SipShared.swift",
        "SipWidget/SipWidget.swift", "SipWidget/SipWidgetBundle.swift",
    ],
}
# The test target gets the app module via @testable import.
TEST_SOURCES = ["SipTests/AddDrinkIntentTests.swift", "SipTests/DayKeyTests.swift",
                "SipTests/DrinkStoreTests.swift", "SipTests/TestSupport.swift"]

DECLARATION = re.compile(r"^(?:@\w+\s+)*(?:public |internal |private |fileprivate |final |@MainActor )*"
                         r"(struct|class|enum|actor|protocol)\s+(\w+)", re.MULTILINE)


def strip_noise(text):
    """Remove comments and string literals so bracket counting is honest."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        char = text[i]
        if text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end == -1 else end
        elif text.startswith("/*", i):
            end = text.find("*/", i)
            i = n if end == -1 else end + 2
        elif text.startswith('"""', i):
            end = text.find('"""', i + 3)
            i = n if end == -1 else end + 3
        elif char == '"':
            i += 1
            depth = 0
            while i < n:
                if text[i] == "\\":
                    # String interpolation can contain brackets; keep them.
                    if text.startswith("\\(", i):
                        depth += 1
                        out.append("(")
                        i += 2
                        continue
                    i += 2
                    continue
                if text[i] == ")" and depth:
                    depth -= 1
                    out.append(")")
                    i += 1
                    continue
                if text[i] == '"' and depth == 0:
                    i += 1
                    break
                i += 1
        else:
            out.append(char)
            i += 1
    return "".join(out)


def check_balance(path, text):
    problems = []
    clean = strip_noise(text)
    for opener, closer, label in [("{", "}", "braces"), ("(", ")", "parens"), ("[", "]", "brackets")]:
        if clean.count(opener) != clean.count(closer):
            problems.append("%s: unbalanced %s (%d vs %d)"
                            % (path, label, clean.count(opener), clean.count(closer)))
    return problems


def declarations(paths):
    found = {}
    for path in paths:
        text = open(os.path.join(ROOT, path)).read()
        for _, name in DECLARATION.findall(text):
            found[name] = path
    return found


def main():
    problems = []
    all_paths = sorted({p for paths in TARGETS.values() for p in paths} | set(TEST_SOURCES))

    for path in all_paths:
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            problems.append("missing source: %s" % path)
            continue
        problems += check_balance(path, open(full).read())

    project_types = declarations(all_paths)
    print("project types: %s" % ", ".join(sorted(project_types)))

    for target, paths in TARGETS.items():
        available = set(declarations(paths))
        used = set()
        for path in paths:
            text = strip_noise(open(os.path.join(ROOT, path)).read())
            for name in project_types:
                if re.search(r"\b%s\b" % re.escape(name), text):
                    used.add(name)
        missing = used - available
        if missing:
            problems.append("%s uses types it does not compile: %s"
                            % (target, ", ".join(sorted(missing))))
        print("  %-20s compiles %2d types, uses %2d" % (target, len(available), len(used)))

    if problems:
        for problem in problems:
            print("  PROBLEM: %s" % problem)
        return 1
    print("sources look consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
