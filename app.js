document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM loaded. Initializing map...");

  require([
    "esri/WebMap",
    "esri/views/MapView"
  ], function (WebMap, MapView) {

    const webmap = new WebMap({
      portalItem: {
        id: "b30daca1af104a7896a409f51e714e24"
      }
    });

    const view = new MapView({
      container: "viewDiv",
      map: webmap
    });

    // Generate a persistent user ID for Firebase tracking
    function getUserId() {
      let uid = localStorage.getItem("srt_user_id");
      if (!uid) {
        uid = "user_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("srt_user_id", uid);
      }
      return uid;
    }

    view.when(() => {
      console.log("🗺️ Web map and view loaded");

      // Add popup action to each feature layer that contains the 'likes' field
      webmap.layers.forEach(layer => {
        layer.when(() => {
          if (layer.fields.some(f => f.name === "likes")) {
            console.log(`👍 Adding Like action to layer: ${layer.title}`);

            layer.popupTemplate.actions = [
              ...(layer.popupTemplate.actions || []),
              {
                title: "Like",
                id: "like-action",
                className: "esri-icon-thumbs-up"
              }
            ];
          }
        });
      });

      view.popup.viewModel.on("trigger-action", async function (event) {
        if (event.action.id !== "like-action") return;

        const graphic = view.popup.selectedFeature;
        if (!graphic || !window.db) return;

        const objectId = graphic.attributes.OBJECTID;
        const userId = getUserId();
        const likeDocRef = window.db.collection("likes").doc(userId);
        const doc = await likeDocRef.get();
        const alreadyLiked = doc.exists && doc.data()?.[`feature_${objectId}`];

        if (alreadyLiked) {
          alert("You already liked this.");
          return;
        }

        await likeDocRef.set({ [`feature_${objectId}`]: true }, { merge: true });

        const currentLikes = graphic.attributes.likes || 0;
        const updatedFeature = {
          attributes: {
            OBJECTID: objectId,
            likes: currentLikes + 1
          }
        };

        const layer = graphic.layer;

        layer.applyEdits({ updateFeatures: [updatedFeature] })
          .then(() => {
            console.log("✅ Likes updated via applyEdits");

            // Refresh the popup so the user sees the updated count
            setTimeout(() => {
              layer.queryFeatureCount().then(() => {
                view.popup.close();
                view.popup.open({
                  features: [graphic],
                  location: graphic.geometry
                });
              });
            }, 500);
          })
          .catch(err => console.error("❌ Error updating likes:", err));
      });
    });
  });
});
