document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting map setup... (v7)");

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

    async function getLikeCount(objectId) {
      const doc = await summaryRef.get();
      return doc.exists && doc.data()?.[objectId] ? doc.data()[objectId] : 0;
    }

    async function incrementLike(objectId) {
      const userId = getUserId();
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId];

      if (alreadyLiked) {
        await userRef.set({ [objectId]: firebase.firestore.FieldValue.delete() }, { merge: true });
        await summaryRef.set({
          [objectId]: firebase.firestore.FieldValue.increment(-1)
        }, { merge: true });
        return await getLikeCount(objectId);
      } else {
        await userRef.set({ [objectId]: true }, { merge: true });
        await summaryRef.set({
          [objectId]: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });
        return await getLikeCount(objectId);
      }
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded.");

      reactiveUtils.when(() => view.popup.viewModel, () => {
        console.log("🔁 Popup viewModel ready");

        reactiveUtils.watch(() => view.popup.visible, async (visible) => {
          console.log("👁 Popup visibility changed:", visible);
          if (!visible) return;

          const graphic = view.popup?.features?.[0];
          console.log("🔎 Selected feature:", graphic);
          const attributes = graphic?.attributes;
          const objectId = attributes?.objectid?.toString();

          if (!objectId) {
            console.warn("⚠️ No valid objectid on feature.");
            return;
          }

          const count = await getLikeCount(objectId);
          console.log(`👍 Likes for objectid ${objectId}:`, count);

          view.popup.actions.removeAll();
          view.popup.actions.add({
            title: `${count}`,
            id: "like-action",
            className: "esri-icon-thumbs-up"
          });
        });

        reactiveUtils.on(() => view.popup.viewModel, "trigger-action", async (event) => {
          if (event.action.id !== "like-action") return;

          const graphic = view.popup?.features?.[0];
          const objectId = graphic?.attributes?.objectid?.toString();
          if (!objectId) return;

          const updatedCount = await incrementLike(objectId);
          const likeAction = view.popup.actions.find(a => a.id === "like-action");
          if (likeAction) likeAction.title = `${updatedCount}`;
        });
      });
    });
  });
});
