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

      // Watch for popup changes and inject Like action if eligible
      view.popup.watch("selectedFeature", (graphic) => {
        if (!graphic || !graphic.attributes || !graphic.attributes.likes) return;

        const actions = view.popup.actions.toArray();
        const alreadyHasLike = actions.some(action => action.id === "like-action");

        if (!alreadyHasLike) {
          view.popup.actions.add({
            id: "like-action",
            title: "Like",
            className: "esri-icon-thumbs-up"
          });
        }
      });

      view.popup.viewModel.on("trigger-action", async (event) => {
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
        const updatedLikes = currentLikes + 1;
        const updatedFeature = {
          attributes: {
            OBJECTID: objectId,
            likes: updatedLikes
          }
        };

        const layer = graphic.layer;

        layer.applyEdits({ updateFeatures: [updatedFeature] })
          .then(() => {
            console.log("✅ Likes updated");

            // Update the value in memory
            graphic.attributes.likes = updatedLikes;

            // Try to update the popup HTML directly (if possible)
            const popupContentNode = view.popup.content;
            if (typeof popupContentNode === "string") {
              view.popup.content = popupContentNode.replace(
                /<strong>Likes:<\/strong>\s*\d+/,
                `<strong>Likes:</strong> ${updatedLikes}`
              );
            }

            // Optional: success message
            // alert("Thanks for liking!");
          })
          .catch(err => console.error("❌ Failed to apply edit:", err));
      });
    });
  });
});
