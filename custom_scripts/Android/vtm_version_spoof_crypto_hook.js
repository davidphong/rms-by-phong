"use strict";

/*
 * Viettel Money combined hook for RMS/Frida.
 *
 * - Spoofs app version from 8.8.38 to 8.8.53.
 * - Patches request Data("app_version", ...) in both old and new request stacks.
 * - Waits for com.bplus.vtpay.ws.Crypto and hooks Crypto.encrypt().
 *
 * Default behavior only logs Crypto.encrypt() and returns the real encrypted value.
 * Change RETURN_PLAINTEXT_FROM_CRYPTO to true only when intentionally testing
 * plaintext replacement.
 */

Java.perform(function () {
  var TARGET_PACKAGE = "com.bplus.vtpay";
  var FROM = "8.8.38";
  var TO = "8.8.53";
  var VERSION_CODE = 8053;
  var RETURN_PLAINTEXT_FROM_CRYPTO = false;

  var patchLogCount = 0;
  var cryptoHookInstalled = false;

  function log(message) {
    send("[VTM_VERSION_CRYPTO] " + message);
  }

  function safeToString(value) {
    try {
      if (value === null || value === undefined) {
        return "" + value;
      }
      return value.toString();
    } catch (e) {
      return "<toString failed: " + e + ">";
    }
  }

  function logPatch(message) {
    if (patchLogCount < 20) {
      log(message);
      patchLogCount++;
      if (patchLogCount === 20) {
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

      try {
        info.versionCode.value = VERSION_CODE;
      } catch (e1) {}

      try {
        info.setLongVersionCode(VERSION_CODE);
      } catch (e2) {}
    } catch (e) {
      log("patchPackageInfo failed: " + e);
    }

    return info;
  }

  function installPackageInfoSpoof() {
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
  }

  function installBuildConfigSpoof() {
    try {
      var BuildConfig = Java.use("com.bplus.vtpay.BuildConfig");
      BuildConfig.VERSION_NAME.value = TO;
      log("BuildConfig.VERSION_NAME -> " + TO);
    } catch (e) {
      log("BuildConfig.VERSION_NAME hook skipped: " + e);
    }
  }

  function installToolboxVersionSpoof() {
    try {
      var Toolbox = Java.use("com.bplus.vtpay.util.Toolbox");
      var normalize = Toolbox.nomalLizieNumberWithDots.overload("java.lang.String");

      normalize.implementation = function (input) {
        var result = normalize.call(this, input);
        var resultString = safeToString(result);

        if (resultString === FROM || resultString !== TO) {
          logPatch("Toolbox.nomalLizieNumberWithDots " + resultString + " -> " + TO);
          return TO;
        }

        return result;
      };

      log("hooked Toolbox.nomalLizieNumberWithDots(String)");
    } catch (e) {
      log("Toolbox version hook skipped: " + e);
    }
  }

  function installDataVersionSpoof(className) {
    try {
      var Data = Java.use(className);
      var initStringString = Data.$init.overload("java.lang.String", "java.lang.String");

      initStringString.implementation = function (key, value) {
        var keyString = safeToString(key);
        var valueString = safeToString(value);

        if (keyString === "app_version") {
          logPatch(className + " app_version " + valueString + " -> " + TO);
          value = TO;
        }

        return initStringString.call(this, key, value);
      };

      log("hooked " + className + ".$init(String,String)");
    } catch (e) {
      log("Data version hook skipped for " + className + ": " + e);
    }
  }

  function installCryptoEncryptHook() {
    if (cryptoHookInstalled) {
      return true;
    }

    try {
      var Crypto = Java.use("com.bplus.vtpay.ws.Crypto");
      var encrypt = Crypto.encrypt.overload(
        "java.lang.String",
        "java.lang.String",
        "java.lang.Boolean"
      );

      encrypt.implementation = function (dataToEncrypt, pubCer, isFile) {
        log(
          "Crypto.encrypt called\n" +
          "isFile: " + safeToString(isFile) + "\n" +
          "dataToEncrypt:\n" + safeToString(dataToEncrypt)
        );

        var result = encrypt.call(this, dataToEncrypt, pubCer, isFile);
        log("Crypto.encrypt output:\n" + safeToString(result));

        if (RETURN_PLAINTEXT_FROM_CRYPTO) {
          log("Crypto.encrypt returning plaintext because RETURN_PLAINTEXT_FROM_CRYPTO=true");
          return dataToEncrypt;
        }

        return result;
      };

      cryptoHookInstalled = true;
      log("hooked com.bplus.vtpay.ws.Crypto.encrypt(String,String,Boolean)");
      return true;
    } catch (e) {
      return false;
    }
  }

  function waitForCrypto() {
    var tryCount = 0;
    var maxTries = 120;
    var timer = setInterval(function () {
      tryCount++;

      if (installCryptoEncryptHook()) {
        clearInterval(timer);
        return;
      }

      if (tryCount === 1 || tryCount % 10 === 0) {
        log("waiting for com.bplus.vtpay.ws.Crypto... " + tryCount + "/" + maxTries);
      }

      if (tryCount >= maxTries) {
        clearInterval(timer);
        log("Crypto.encrypt hook not installed after waiting");
      }
    }, 500);
  }

  installPackageInfoSpoof();
  installBuildConfigSpoof();
  installToolboxVersionSpoof();
  installDataVersionSpoof("com.bplus.vtpay.model.Data");
  installDataVersionSpoof("vn.viettelpay.network.newbase.xml.Data");
  waitForCrypto();

  log("version spoof + crypto hook installed " + FROM + " -> " + TO);
});
