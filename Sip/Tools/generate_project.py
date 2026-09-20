#!/usr/bin/env python3
"""Generates Sip.xcodeproj/project.pbxproj.

Hand-editing a pbxproj is miserable, so the project is generated instead:
add a file to the tree below, re-run this, and the project stays consistent.
Every identifier is derived from a counter, so regenerating produces a
byte-identical file and git diffs stay readable.

    python3 Tools/generate_project.py
"""
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

APP_NAME = "Sip"
WIDGET_NAME = "SipWidgetExtension"
TESTS_NAME = "SipTests"

BUNDLE_ID = "com.tadhgfinn.sip"
WIDGET_BUNDLE_ID = BUNDLE_ID + ".SipWidget"
TESTS_BUNDLE_ID = BUNDLE_ID + ".SipTests"

DEPLOYMENT_TARGET = "17.0"
SWIFT_VERSION = "5.0"

# --- the file tree ----------------------------------------------------------
# Shared sources compile into both the app and the widget extension.
CORE_SOURCES = [
    "DayKey.swift",
    "Drink.swift",
    "DrinkStore.swift",
    "SipShared.swift",
]
APP_ONLY_CORE_SOURCES = [
    "SipSettings.swift",
    "SipEnvironment.swift",
    "Haptics.swift",
]
INTENT_SOURCES = [
    "AddDrinkIntent.swift",
    "DrinkCountSnippet.swift",
    "SipShortcuts.swift",
]
APP_SOURCES = [
    "ActionButtonGuideView.swift",
    "DataExport.swift",
    "DrinkCardView.swift",
    "HistoryView.swift",
    "OnboardingView.swift",
    "RootView.swift",
    "SettingsView.swift",
    "SipApp.swift",
    "Theme.swift",
    "TodayView.swift",
]
WIDGET_SOURCES = [
    "SipWidget.swift",
    "SipWidgetBundle.swift",
]
TEST_SOURCES = [
    "AddDrinkIntentTests.swift",
    "DayKeyTests.swift",
    "DrinkStoreTests.swift",
    "TestSupport.swift",
]


class IDs:
    """Stable, sequential object identifiers."""

    def __init__(self):
        self.counter = 0
        self.cache = {}

    def get(self, key):
        if key not in self.cache:
            self.counter += 1
            self.cache[key] = "51%022X" % self.counter
        return self.cache[key]


ids = IDs()

SIMPLE = re.compile(r"^[A-Za-z0-9_.]+$")


def value(raw):
    if isinstance(raw, list):
        return "(\n" + "".join("\t\t\t\t%s,\n" % value(item) for item in raw) + "\t\t\t)"
    text = str(raw)
    if text and SIMPLE.match(text):
        return text
    return '"%s"' % text.replace('"', '\\"')


def settings_block(settings, indent="\t\t\t\t"):
    lines = []
    for key in sorted(settings):
        lines.append("%s%s = %s;" % (indent, key, value(settings[key])))
    return "\n".join(lines)


# --- build settings ---------------------------------------------------------
COMMON_PROJECT = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "CLANG_ANALYZER_NONNULL": "YES",
    "CLANG_ENABLE_MODULES": "YES",
    "CLANG_ENABLE_OBJC_ARC": "YES",
    "COPY_PHASE_STRIP": "NO",
    "ENABLE_STRICT_OBJC_MSGSEND": "YES",
    "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
    "GCC_C_LANGUAGE_STANDARD": "gnu17",
    "GCC_NO_COMMON_BLOCKS": "YES",
    "IPHONEOS_DEPLOYMENT_TARGET": DEPLOYMENT_TARGET,
    "LOCALIZATION_PREFERS_STRING_CATALOGS": "YES",
    "MTL_FAST_MATH": "YES",
    "SDKROOT": "iphoneos",
    "SWIFT_VERSION": SWIFT_VERSION,
}

PROJECT_DEBUG = dict(COMMON_PROJECT, **{
    "DEBUG_INFORMATION_FORMAT": "dwarf",
    "ENABLE_TESTABILITY": "YES",
    "GCC_DYNAMIC_NO_PIC": "NO",
    "GCC_OPTIMIZATION_LEVEL": "0",
    "GCC_PREPROCESSOR_DEFINITIONS": ["DEBUG=1", "$(inherited)"],
    "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE",
    "ONLY_ACTIVE_ARCH": "YES",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG $(inherited)",
    "SWIFT_OPTIMIZATION_LEVEL": "-Onone",
})

PROJECT_RELEASE = dict(COMMON_PROJECT, **{
    "DEBUG_INFORMATION_FORMAT": "dwarf-with-dsym",
    "ENABLE_NS_ASSERTIONS": "NO",
    "GCC_OPTIMIZATION_LEVEL": "s",
    "MTL_ENABLE_DEBUG_INFO": "NO",
    "SWIFT_COMPILATION_MODE": "wholemodule",
    "VALIDATE_PRODUCT": "YES",
})

APP_TARGET = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "ENABLE_PREVIEWS": "YES",
    "GENERATE_INFOPLIST_FILE": "YES",
    "INFOPLIST_FILE": "Sip/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "Sip",
    "INFOPLIST_KEY_UIApplicationSceneManifest_Generation": "YES",
    "INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents": "YES",
    "INFOPLIST_KEY_UILaunchScreen_Generation": "YES",
    "INFOPLIST_KEY_UIStatusBarStyle": "UIStatusBarStyleDefault",
    "INFOPLIST_KEY_UISupportedInterfaceOrientations": "UIInterfaceOrientationPortrait",
    "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@executable_path/Frameworks"],
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID,
    "PRODUCT_NAME": "$(TARGET_NAME)",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "TARGETED_DEVICE_FAMILY": "1",
}

WIDGET_TARGET = {
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME": "WidgetBackground",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "ENABLE_PREVIEWS": "YES",
    "GENERATE_INFOPLIST_FILE": "YES",
    "INFOPLIST_FILE": "SipWidget/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "Sip",
    "LD_RUNPATH_SEARCH_PATHS": [
        "$(inherited)",
        "@executable_path/Frameworks",
        "@executable_path/../../Frameworks",
    ],
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": WIDGET_BUNDLE_ID,
    "PRODUCT_NAME": "$(TARGET_NAME)",
    "SKIP_INSTALL": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "TARGETED_DEVICE_FAMILY": "1",
}

TESTS_TARGET = {
    "BUNDLE_LOADER": "$(TEST_HOST)",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "GENERATE_INFOPLIST_FILE": "YES",
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": TESTS_BUNDLE_ID,
    "PRODUCT_NAME": "$(TARGET_NAME)",
    "SWIFT_EMIT_LOC_STRINGS": "NO",
    "TARGETED_DEVICE_FAMILY": "1",
    "TEST_HOST": "$(BUILT_PRODUCTS_DIR)/Sip.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Sip",
}


def file_type(name):
    if name.endswith(".swift"):
        return "sourcecode.swift"
    if name.endswith(".plist"):
        return "text.plist.xml"
    if name.endswith(".xcassets"):
        return "folder.assetcatalog"
    raise ValueError("unknown file type for " + name)


class Project:
    def __init__(self):
        self.objects = []          # (isa, id, comment, body)
        self.file_refs = {}        # path -> id

    def add(self, isa, key, comment, body):
        object_id = ids.get(key)
        self.objects.append((isa, object_id, comment, body))
        return object_id

    def file_ref(self, path):
        """path is relative to the project directory; the reference is by name
        within its group."""
        if path in self.file_refs:
            return self.file_refs[path]
        name = os.path.basename(path)
        body = ("{isa = PBXFileReference; lastKnownFileType = %s; path = %s; sourceTree = \"<group>\"; }"
                % (file_type(name), value(name)))
        object_id = self.add("PBXFileReference", "ref:" + path, name, body)
        self.file_refs[path] = object_id
        return object_id

    def product_ref(self, name, explicit_type):
        body = ("{isa = PBXFileReference; explicitFileType = %s; includeInIndex = 0; path = %s; "
                "sourceTree = BUILT_PRODUCTS_DIR; }" % (value(explicit_type), value(name)))
        return self.add("PBXFileReference", "product:" + name, name, body)

    def build_file(self, path, phase, settings=None):
        return self.build_file_for_ref(self.file_ref(path), os.path.basename(path), phase, settings)

    def build_file_for_ref(self, ref, name, phase, settings=None):
        extra = (" settings = {%s}; " % settings) if settings else " "
        body = ("{isa = PBXBuildFile; fileRef = %s /* %s */;%s}" % (ref, name, extra))
        return self.add("PBXBuildFile", "build:%s:%s" % (phase, name),
                        "%s in %s" % (name, phase), body)

    def group(self, key, children, name=None, path=None):
        lines = ["{isa = PBXGroup; children = ("]
        for child_id, child_name in children:
            lines.append("\t\t\t\t%s /* %s */," % (child_id, child_name))
        tail = "\t\t\t); "
        if name:
            tail += "name = %s; " % value(name)
        if path:
            tail += "path = %s; " % value(path)
        tail += "sourceTree = \"<group>\"; }"
        lines.append(tail)
        return self.add("PBXGroup", "group:" + key, name or path or key, "\n".join(lines))

    def build_phase(self, isa, key, comment, files, extra=""):
        lines = ["{isa = %s; buildActionMask = 2147483647; files = (" % isa]
        for file_id, file_comment in files:
            lines.append("\t\t\t\t%s /* %s */," % (file_id, file_comment))
        lines.append("\t\t\t); %srunOnlyForDeploymentPostprocessing = 0; }" % extra)
        return self.add(isa, "phase:" + key, comment, "\n".join(lines))

    def config_list(self, key, name, debug_settings, release_settings):
        debug = self.add("XCBuildConfiguration", "config:%s:Debug" % key, "Debug",
                         "{isa = XCBuildConfiguration; buildSettings = {\n%s\n\t\t\t}; name = Debug; }"
                         % settings_block(debug_settings))
        release = self.add("XCBuildConfiguration", "config:%s:Release" % key, "Release",
                           "{isa = XCBuildConfiguration; buildSettings = {\n%s\n\t\t\t}; name = Release; }"
                           % settings_block(release_settings))
        body = ("{isa = XCConfigurationList; buildConfigurations = (\n"
                "\t\t\t\t%s /* Debug */,\n\t\t\t\t%s /* Release */,\n"
                "\t\t\t); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }"
                % (debug, release))
        return self.add("XCConfigurationList", "configlist:" + key,
                        "Build configuration list for %s" % name, body)


def build():
    project = Project()

    # ---- sources -----------------------------------------------------------
    app_source_paths = (
        ["Sip/Core/" + n for n in CORE_SOURCES + APP_ONLY_CORE_SOURCES]
        + ["Sip/Intents/" + n for n in INTENT_SOURCES]
        + ["Sip/App/" + n for n in APP_SOURCES]
    )
    widget_source_paths = (
        ["Sip/Core/" + n for n in CORE_SOURCES]
        + ["SipWidget/" + n for n in WIDGET_SOURCES]
    )
    test_source_paths = ["SipTests/" + n for n in TEST_SOURCES]

    app_sources = [(project.build_file(p, "Sources (Sip)"), os.path.basename(p) + " in Sources")
                   for p in app_source_paths]
    app_resources = [(project.build_file("Sip/Assets.xcassets", "Resources (Sip)"),
                      "Assets.xcassets in Resources")]

    widget_sources = [(project.build_file(p, "Sources (SipWidgetExtension)"),
                       os.path.basename(p) + " in Sources") for p in widget_source_paths]
    widget_resources = [(project.build_file("SipWidget/Assets.xcassets", "Resources (SipWidgetExtension)"),
                         "Assets.xcassets in Resources")]

    test_sources = [(project.build_file(p, "Sources (SipTests)"), os.path.basename(p) + " in Sources")
                    for p in test_source_paths]

    # Info.plists are referenced by INFOPLIST_FILE, never copied as resources.
    app_plist = project.file_ref("Sip/Info.plist")
    widget_plist = project.file_ref("SipWidget/Info.plist")

    # ---- products ----------------------------------------------------------
    app_product = project.product_ref("Sip.app", "wrapper.application")
    widget_product = project.product_ref("SipWidgetExtension.appex", "wrapper.app-extension")
    tests_product = project.product_ref("SipTests.xctest", "wrapper.cfbundle")

    # ---- groups ------------------------------------------------------------
    core_group = project.group(
        "core",
        [(project.file_ref("Sip/Core/" + n), n) for n in CORE_SOURCES + APP_ONLY_CORE_SOURCES],
        path="Core")
    intents_group = project.group(
        "intents",
        [(project.file_ref("Sip/Intents/" + n), n) for n in INTENT_SOURCES],
        path="Intents")
    app_group = project.group(
        "appviews",
        [(project.file_ref("Sip/App/" + n), n) for n in APP_SOURCES],
        path="App")
    sip_group = project.group(
        "sip",
        [(core_group, "Core"), (intents_group, "Intents"), (app_group, "App"),
         (project.file_ref("Sip/Assets.xcassets"), "Assets.xcassets"),
         (app_plist, "Info.plist")],
        path="Sip")
    widget_group = project.group(
        "widget",
        [(project.file_ref("SipWidget/" + n), n) for n in WIDGET_SOURCES]
        + [(project.file_ref("SipWidget/Assets.xcassets"), "Assets.xcassets"),
           (widget_plist, "Info.plist")],
        path="SipWidget")
    tests_group = project.group(
        "tests",
        [(project.file_ref("SipTests/" + n), n) for n in TEST_SOURCES],
        path="SipTests")
    products_group = project.group(
        "products",
        [(app_product, "Sip.app"), (widget_product, "SipWidgetExtension.appex"),
         (tests_product, "SipTests.xctest")],
        name="Products")
    main_group = project.group(
        "main",
        [(sip_group, "Sip"), (widget_group, "SipWidget"), (tests_group, "SipTests"),
         (products_group, "Products")])

    # ---- build phases ------------------------------------------------------
    app_sources_phase = project.build_phase("PBXSourcesBuildPhase", "app-sources", "Sources", app_sources)
    app_frameworks_phase = project.build_phase("PBXFrameworksBuildPhase", "app-frameworks", "Frameworks", [])
    app_resources_phase = project.build_phase("PBXResourcesBuildPhase", "app-resources", "Resources", app_resources)

    embed_file = project.build_file_for_ref(
        widget_product, "SipWidgetExtension.appex", "Embed Foundation Extensions",
        settings="ATTRIBUTES = (RemoveHeadersOnCopy, ); ")
    embed_phase = project.build_phase(
        "PBXCopyFilesBuildPhase", "app-embed", "Embed Foundation Extensions",
        [(embed_file, "SipWidgetExtension.appex in Embed Foundation Extensions")],
        extra='dstPath = ""; dstSubfolderSpec = 13; name = "Embed Foundation Extensions"; ')

    widget_sources_phase = project.build_phase("PBXSourcesBuildPhase", "widget-sources", "Sources", widget_sources)
    widget_frameworks_phase = project.build_phase("PBXFrameworksBuildPhase", "widget-frameworks", "Frameworks", [])
    widget_resources_phase = project.build_phase("PBXResourcesBuildPhase", "widget-resources", "Resources", widget_resources)

    tests_sources_phase = project.build_phase("PBXSourcesBuildPhase", "tests-sources", "Sources", test_sources)
    tests_frameworks_phase = project.build_phase("PBXFrameworksBuildPhase", "tests-frameworks", "Frameworks", [])
    tests_resources_phase = project.build_phase("PBXResourcesBuildPhase", "tests-resources", "Resources", [])

    project_id = ids.get("project")

    # ---- dependencies ------------------------------------------------------
    widget_proxy = project.add(
        "PBXContainerItemProxy", "proxy:widget", "PBXContainerItemProxy",
        "{isa = PBXContainerItemProxy; containerPortal = %s /* Project object */; proxyType = 1; "
        "remoteGlobalIDString = %s; remoteInfo = %s; }"
        % (project_id, ids.get("target:widget"), WIDGET_NAME))
    widget_dependency = project.add(
        "PBXTargetDependency", "dep:widget", "PBXTargetDependency",
        "{isa = PBXTargetDependency; target = %s /* %s */; targetProxy = %s /* PBXContainerItemProxy */; }"
        % (ids.get("target:widget"), WIDGET_NAME, widget_proxy))

    app_proxy = project.add(
        "PBXContainerItemProxy", "proxy:app", "PBXContainerItemProxy",
        "{isa = PBXContainerItemProxy; containerPortal = %s /* Project object */; proxyType = 1; "
        "remoteGlobalIDString = %s; remoteInfo = %s; }"
        % (project_id, ids.get("target:app"), APP_NAME))
    app_dependency = project.add(
        "PBXTargetDependency", "dep:app", "PBXTargetDependency",
        "{isa = PBXTargetDependency; target = %s /* %s */; targetProxy = %s /* PBXContainerItemProxy */; }"
        % (ids.get("target:app"), APP_NAME, app_proxy))

    # ---- configuration lists ----------------------------------------------
    project_configs = project.config_list("project", "PBXProject \"Sip\"", PROJECT_DEBUG, PROJECT_RELEASE)
    app_configs = project.config_list("app", "PBXNativeTarget \"Sip\"", APP_TARGET, APP_TARGET)
    widget_configs = project.config_list("widget", "PBXNativeTarget \"SipWidgetExtension\"",
                                         WIDGET_TARGET, WIDGET_TARGET)
    tests_configs = project.config_list("tests", "PBXNativeTarget \"SipTests\"", TESTS_TARGET, TESTS_TARGET)

    # ---- targets -----------------------------------------------------------
    def native_target(key, name, configs, phases, dependencies, product, product_type):
        phase_lines = "".join("\n\t\t\t\t%s," % p for p in phases)
        dependency_lines = "".join("\n\t\t\t\t%s," % d for d in dependencies)
        body = ("{isa = PBXNativeTarget; buildConfigurationList = %s; buildPhases = (%s\n\t\t\t); "
                "buildRules = (); dependencies = (%s\n\t\t\t); name = %s; productName = %s; "
                "productReference = %s; productType = %s; }"
                % (configs, phase_lines, dependency_lines, value(name), value(name),
                   product, value(product_type)))
        return project.add("PBXNativeTarget", key, name, body)

    app_target = native_target(
        "target:app", APP_NAME, app_configs,
        [app_sources_phase, app_frameworks_phase, app_resources_phase, embed_phase],
        [widget_dependency], app_product, "com.apple.product-type.application")
    widget_target = native_target(
        "target:widget", WIDGET_NAME, widget_configs,
        [widget_sources_phase, widget_frameworks_phase, widget_resources_phase],
        [], widget_product, "com.apple.product-type.app-extension")
    tests_target = native_target(
        "target:tests", TESTS_NAME, tests_configs,
        [tests_sources_phase, tests_frameworks_phase, tests_resources_phase],
        [app_dependency], tests_product, "com.apple.product-type.bundle.unit-test")

    # ---- project -----------------------------------------------------------
    project_body = (
        "{isa = PBXProject; attributes = {\n"
        "\t\t\t\tBuildIndependentTargetsInParallel = 1;\n"
        "\t\t\t\tLastSwiftUpdateCheck = 1600;\n"
        "\t\t\t\tLastUpgradeCheck = 1600;\n"
        "\t\t\t\tTargetAttributes = {\n"
        "\t\t\t\t\t%s = {CreatedOnToolsVersion = 16.0; };\n"
        "\t\t\t\t\t%s = {CreatedOnToolsVersion = 16.0; };\n"
        "\t\t\t\t\t%s = {CreatedOnToolsVersion = 16.0; TestTargetID = %s; };\n"
        "\t\t\t\t};\n"
        "\t\t\t}; buildConfigurationList = %s; compatibilityVersion = \"Xcode 14.0\"; "
        "developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (\n"
        "\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t); mainGroup = %s; productRefGroup = %s /* Products */; "
        "projectDirPath = \"\"; projectRoot = \"\"; targets = (\n"
        "\t\t\t\t%s /* Sip */,\n\t\t\t\t%s /* SipWidgetExtension */,\n\t\t\t\t%s /* SipTests */,\n"
        "\t\t\t); }"
        % (app_target, widget_target, tests_target, app_target,
           project_configs, main_group, products_group,
           app_target, widget_target, tests_target))
    project.objects.append(("PBXProject", project_id, "Project object", project_body))

    return project, project_id


def render(project, project_id):
    out = ["// !$*UTF8*$!", "{", "\tarchiveVersion = 1;", "\tclasses = {", "\t};",
           "\tobjectVersion = 56;", "\tobjects = {"]

    order = ["PBXBuildFile", "PBXContainerItemProxy", "PBXCopyFilesBuildPhase", "PBXFileReference",
             "PBXFrameworksBuildPhase", "PBXGroup", "PBXNativeTarget", "PBXProject",
             "PBXResourcesBuildPhase", "PBXSourcesBuildPhase", "PBXTargetDependency",
             "XCBuildConfiguration", "XCConfigurationList"]

    for isa in order:
        entries = [o for o in project.objects if o[0] == isa]
        if not entries:
            continue
        out.append("")
        out.append("/* Begin %s section */" % isa)
        for _, object_id, comment, body in sorted(entries, key=lambda o: o[1]):
            out.append("\t\t%s /* %s */ = %s;" % (object_id, comment, body))
        out.append("/* End %s section */" % isa)

    out.append("\t};")
    out.append("\trootObject = %s /* Project object */;" % project_id)
    out.append("}")
    return "\n".join(out) + "\n"


def verify(text, project):
    """Cheap structural checks: balanced braces, and every referenced id defined."""
    problems = []
    if text.count("{") != text.count("}"):
        problems.append("unbalanced braces: %d open, %d close" % (text.count("{"), text.count("}")))
    if text.count("(") != text.count(")"):
        problems.append("unbalanced parens: %d open, %d close" % (text.count("("), text.count(")")))

    defined = {o[1] for o in project.objects}
    referenced = set(re.findall(r"\b51[0-9A-F]{22}\b", text))
    missing = referenced - defined
    if missing:
        problems.append("referenced but not defined: %s" % ", ".join(sorted(missing)))
    unused = defined - referenced
    if unused:
        problems.append("defined but never referenced: %s" % ", ".join(sorted(unused)))
    return problems


def check_files_exist():
    missing = []
    for path in sorted(p for p in ids.cache if p.startswith("ref:")):
        relative = path[len("ref:"):]
        if not os.path.exists(os.path.join(ROOT, relative)):
            missing.append(relative)
    return missing



SCHEME = """<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{app}"
               BuildableName = "Sip.app"
               BlueprintName = "Sip"
               ReferencedContainer = "container:Sip.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{tests}"
               BuildableName = "SipTests.xctest"
               BlueprintName = "SipTests"
               ReferencedContainer = "container:Sip.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{app}"
            BuildableName = "Sip.app"
            BlueprintName = "Sip"
            ReferencedContainer = "container:Sip.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{app}"
            BuildableName = "Sip.app"
            BlueprintName = "Sip"
            ReferencedContainer = "container:Sip.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""


def write_scheme():
    path = os.path.join(ROOT, "Sip.xcodeproj", "xcshareddata", "xcschemes", "Sip.xcscheme")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as handle:
        handle.write(SCHEME.format(app=ids.get("target:app"), tests=ids.get("target:tests")))
    return path


if __name__ == "__main__":
    project, project_id = build()
    text = render(project, project_id)

    problems = verify(text, project)
    missing = check_files_exist()

    destination = os.path.join(ROOT, "Sip.xcodeproj", "project.pbxproj")
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    with open(destination, "w") as handle:
        handle.write(text)

    scheme = write_scheme()

    print("wrote %s (%d objects, %d bytes)" % (destination, len(project.objects), len(text)))
    print("wrote %s" % scheme)
    for problem in problems:
        print("  PROBLEM: %s" % problem)
    for path in missing:
        print("  MISSING FILE: %s" % path)
    sys.exit(1 if problems or missing else 0)
