document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting minimal map setup...");

  require([
    "esri/WebMap",
    "esri/views/MapView"
  ], function (WebMap, MapView) {
    const webmap = new WebMap({
      portalItem: {
        id: "b30daca1af104a7896a409f51e714e24" // Your web map
      }
    });

    const view = new MapView({
      container: "viewDiv",
      map: webmap
    });

    view.when(() => {
      console.log("🗺️ Map and view loaded!");
      window.view = view;
      console.log("🌍 'view' is now globally available");
    });
  });
});
