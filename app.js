document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting map setup... (v5)");

  require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/core/reactiveUtils"
  ], function (WebMap, MapView, reactiveUtils) {

    const webmap = new WebMap({
      portalItem: {
        id: "b30daca1af104a7896a409f51e714e24"
      }
    });

    const view = new MapView({
      container: "viewDiv",
      map: webmap
    });

    const db = window.db;
    const summaryRef = db.collection("likes_summary").doc("counts");

    function getUserId() {
      let uid = localStorage.getItem("srt_user_id");
      if (!uid) {
        uid = "user_" + Math.random().toString(36).substring(2);
        localStorage.setItem("srt_user_id", uid);
      }
      return uid;
    }

    function showLikeBurst() {
      const burst = document.createElement("div");
      burst.className = "like-burst";
      burst.textContent = "+1";
      document.body.appendChild(burst);
      setTimeout(() => burst.style.top = "30%", 10);
      setTimeout(() => burst.style.opacity = "0", 500);
      setTimeout(() => burst.remove(), 1000);
    }

    async function getLikeCount(objectId) {
      const doc = await summaryRef.get();
      return doc.exists && doc.data()[objectId] ? doc.data()[objectId] : 0;
    }

    async function incrementLike(objectId) {
      const userId = getUserId();
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId];

      if (alreadyLiked) {
        alert("You've already liked this.");
        return null;
      }

      await userRef.set({ [objectId]: true }, { merge: true });
      await summaryRef.set({
        [objectId]: firebase.firestore.FieldValue.increment(1)
      }, { merge: true });

      return await getLikeCount(objectId);
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded.");
      window.view = view; // 👈 expose for debugging

      webmap.layers.forEach((layer, i) => {
        console.log(`📦 Layer ${i}: ${layer.title}`, layer);
      });

              reactiveUtils.watch(
          () => view.popup.viewModel.active,
          async (isActive) => {
            if (!isActive) return;
            console.log("👁 Popup became active");

            await reactiveUtils.whenOnce(() => view.popup.features?.length > 0);
            const graphic = view.popup.features[0];
            console.log("🔎 Selected feature:", graphic);
            console.log("📄 Attributes available:", graphic?.attributes);
            console.log("🔑 Available attribute keys:", Object.keys(graphic?.attributes || {}));

            if (!graphic?.attributes?.objectid) {
              console.warn("⚠️ No objectid on selected feature.");
              return;
            }

            const objectId = graphic.attributes.objectid.toString();
            const count = await getLikeCount(objectId);
            console.log(`👍 Likes for objectid ${objectId}:`, count);

            view.popup.actions.removeAll();
            view.popup.actions.add({
              title: `${count} Likes`,
              id: "like-action",
              className: "esri-icon-thumbs-up"
            });
          }
        );

        reactiveUtils.on(() => view.popup.viewModel, "trigger-action", async (event) => {
          if (event.action.id !== "like-action") return;

          const graphic = view.popup.features?.[0];
          if (!graphic?.attributes?.objectid) return;

          const objectId = graphic.attributes.objectid.toString();
          const updatedCount = await incrementLike(objectId);
          if (updatedCount !== null) {
            const likeAction = view.popup.actions.find(a => a.id === "like-action");
            if (likeAction) likeAction.title = `${updatedCount} Likes`;
            showLikeBurst();
          }
        });
      });
    });
  });
});
