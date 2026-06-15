"use strict";

(function () {
  var TARGET = "com.bplus.vtpay.ws.Crypto";
  var PREFIX = "[RMS_PROBE]";
  var attempts = 0;
  var maxAttempts = 80;
  var intervalMs = 250;

  function emit(message) {
    send(PREFIX + " " + message);
  }

  function describeRuntime() {
    try {
      var ActivityThread = Java.use("android.app.ActivityThread");
      var app = ActivityThread.currentApplication();
      if (!app) {
        emit("currentApplication=null");
        return;
      }

      var context = app.getApplicationContext();
      emit("package=" + context.getPackageName());
      emit("loader=" + app.getClassLoader());
    } catch (e) {
      emit("runtime lookup failed: " + e);
    }
  }

  function enumerateWsClasses() {
    var classes = [];
    Java.enumerateLoadedClasses({
      onMatch: function (name) {
        if (name.indexOf("com.bplus.vtpay.ws") === 0) {
          classes.push(name);
        }
      },
      onComplete: function () {}
    });
    classes.sort();
    emit("enumerate ws count=" + classes.length + " classes=" + classes.join(","));
  }

  function probe() {
    attempts++;
    Java.perform(function () {
      if (attempts === 1) {
        emit("script loaded. frida=" + Frida.version + " pid=" + Process.id);
        describeRuntime();
      }

      try {
        var Crypto = Java.use(TARGET);
        emit("Java.use OK at attempt=" + attempts + " class=" + Crypto.class);
        try {
          emit("crypto loader=" + Crypto.class.getClassLoader());
        } catch (loaderErr) {
          emit("crypto loader lookup failed: " + loaderErr);
        }
        enumerateWsClasses();
        return;
      } catch (e) {
        if (attempts === 1 || attempts % 10 === 0) {
          emit("Java.use MISS attempt=" + attempts + " error=" + e);
          enumerateWsClasses();
        }
      }

      if (attempts < maxAttempts) {
        setTimeout(probe, intervalMs);
      } else {
        emit("gave up after attempts=" + maxAttempts);
      }
    });
  }

  setTimeout(probe, 1);
})();
