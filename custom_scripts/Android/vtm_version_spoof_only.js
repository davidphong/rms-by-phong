"use strict";

Java.perform(function () {
  var TARGET_PACKAGE = "com.bplus.vtpay";
  var FROM = "8.8.38";
  var TO = "8.8.53";
  var patchLogCount = 0;

  function log(message) {
    send("[VTM_VERSION_ONLY] " + message);
  }

  function logPatch(message) {
    if (patchLogCount < 5) {
      log(message);
      patchLogCount++;
      if (patchLogCount === 5) {
        log("further version patch logs suppressed");
      }
    }
  }

  function patchPackageInfo(info) {
    if (!info) return info;

    try {
      if (info.packageName && info.packageName.value === TARGET_PACKAGE) {
        info.versionName.value = TO;
        logPatch("PackageInfo.versionName -> " + TO);
      } else if (info.versionName && info.versionName.value === FROM) {
        info.versionName.value = TO;
        logPatch("PackageInfo.versionName " + FROM + " -> " + TO);
      }
    } catch (e) {
      log("patchPackageInfo failed: " + e);
    }

    return info;
  }

  try {
    var AppPackageManager = Java.use("android.app.ApplicationPackageManager");
    var getPackageInfoString = AppPackageManager.getPackageInfo.overload("java.lang.String", "int");

    getPackageInfoString.implementation = function (pkg, flags) {
      var info = getPackageInfoString.call(this, pkg, flags);
      if (pkg && pkg.toString() === TARGET_PACKAGE) {
        return patchPackageInfo(info);
      }
      return info;
    };

    log("hooked getPackageInfo(String,int)");
  } catch (e) {
    log("getPackageInfo(String,int) hook failed: " + e);
  }

  try {
    var AppPackageManager2 = Java.use("android.app.ApplicationPackageManager");
    var getPackageInfoVersioned = AppPackageManager2.getPackageInfo.overload("android.content.pm.VersionedPackage", "int");

    getPackageInfoVersioned.implementation = function (versionedPackage, flags) {
      var info = getPackageInfoVersioned.call(this, versionedPackage, flags);
      try {
        if (versionedPackage && versionedPackage.getPackageName().toString() === TARGET_PACKAGE) {
          return patchPackageInfo(info);
        }
      } catch (e) {
        log("VersionedPackage lookup failed: " + e);
      }
      return info;
    };

    log("hooked getPackageInfo(VersionedPackage,int)");
  } catch (e) {
    log("getPackageInfo(VersionedPackage,int) hook skipped: " + e);
  }

  log("version spoof only installed " + FROM + " -> " + TO);
});
