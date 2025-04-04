document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM loaded. Initializing map...");

  require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/widgets/Popup"
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

    view.popup.viewModel.on("trigger-action", async function (event) {
      if (event.action.id === "like-action") {
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
            alert("Thanks for liking!");
            // Update the popup content manually
            graphic.attributes.likes += 1;
            view.popup.content = generatePopupContent(graphic);
          })
          .catch((err) => console.error("Error updating likes:", err));
      }
    });

    view.when(() => {
      webmap.layers.forEach(layer => {
        layer.popupTemplate = {
          title: "{Title}",
          content: (feature) => generatePopupContent(feature.graphic),
          actions: [{
            id: "like-action",
            title: "Like",
            className: "esri-icon-thumb-up"
          }]
        };
      });
    });

    function generatePopupContent(graphic) {
      const likes = graphic.attributes.likes || 0;
      return `
        <p><strong>Description:</strong> ${graphic.attributes.Description || "No description"}</p>
        <p><strong>Likes:</strong> ${likes}</p>
        <p>Click the <span style="color: #30737b;">👍</span> button above to support this location.</p>
      `;
    }
  });
});
