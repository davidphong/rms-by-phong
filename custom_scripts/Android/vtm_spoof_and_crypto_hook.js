"use strict";

Java.perform(function () {
  var TARGET_PACKAGE = "com.bplus.vtpay";
  var FROM = "8.8.38";
  var TO = "8.8.53";
  var patchLogCount = 0;

  function log(message) {
    send("[VTM_COMBO] " + message);
  }

  function logPatch(message) {
    if (patchLogCount < 5) {
      log(message);
      patchLogCount++;
      if (patchLogCount === 5) {
        log("further version spoof logs suppressed");
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
    log("version spoof hooked getPackageInfo(String,int)");
  } catch (e) {
    log("version spoof getPackageInfo(String,int) failed: " + e);
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
    log("version spoof hooked getPackageInfo(VersionedPackage,int)");
  } catch (e) {
    log("version spoof getPackageInfo(VersionedPackage,int) skipped: " + e);
  }

  log("version spoof installed " + FROM + " -> " + TO);
});

(function waitAndHookCrypto() {
  var attempts = 0;
  var maxAttempts = 120;
  var className = "com.bplus.vtpay.ws.Crypto";
  var signature = "public static java.lang.String encrypt(java.lang.String,java.lang.String,java.lang.Boolean) throws java.lang.Exception";

  function install() {
    attempts++;
    Java.perform(function () {
      var Crypto;
      try {
        Crypto = Java.use(className);
      } catch (e) {
        if (attempts === 1 || attempts % 20 === 0) {
          send("[VTM_CRYPTO] waiting for " + className + " attempt=" + attempts + " error=" + e);
        }
        if (attempts < maxAttempts) {
          setTimeout(install, 250);
        } else {
          send("[VTM_CRYPTO] gave up waiting for " + className);
        }
        return;
      }

      try {
        var encrypt = Crypto.encrypt.overload("java.lang.String", "java.lang.String", "java.lang.Boolean");
        encrypt.implementation = function (v0, v1, v2) {
          send("[Call_Stack]\nClass: " + className + "\nMethod: " + signature + "\n");

          send("[Hook_Stack]\nClass: " + className +
            "\nMethod: " + signature +
            "\nInput v0: " + v0 +
            "\nInput v1: " + v1 +
            "\nInput v2: " + v2 + "\n");

          var ret = encrypt.call(this, v0, v1, v2);

          send("[Hook_Stack]\nClass: " + className +
            "\nMethod: " + signature +
            "\nOutput: " + ret + "\n");

          return ret;
        };

        send("[VTM_CRYPTO] hook installed for " + className + ".encrypt at attempt=" + attempts);
      } catch (e) {
        send("[VTM_CRYPTO] hook install failed: " + e);
      }
    });
  }

  setTimeout(install, 1);
})();
