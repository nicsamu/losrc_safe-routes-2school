document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting minimal map setup...");

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

    async function hasUserLiked(objectId) {
      const userId = getUserId();
      const userDoc = await db.collection("likes_users").doc(userId).get();
      return userDoc.exists && userDoc.data()?.[objectId];
    }

    async function toggleLike(objectId) {
      const userId = getUserId();
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId];

      if (alreadyLiked) {
        await userRef.set({ [objectId]: firebase.firestore.FieldValue.delete() }, { merge: true });
        await summaryRef.set({ [objectId]: firebase.firestore.FieldValue.increment(-1) }, { merge: true });
      } else {
        await userRef.set({ [objectId]: true }, { merge: true });
        await summaryRef.set({ [objectId]: firebase.firestore.FieldValue.increment(1) }, { merge: true });
        showLikeBurst();
      }

      return await getLikeCount(objectId);
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded.");
      window.view = view;

      reactiveUtils.when(() => view.popup.viewModel, () => {
        console.log("🔁 Popup viewModel ready");

        reactiveUtils.watch(
          () => view.popup.visible,
          async (visible) => {
            console.log("👁 Popup visible changed:", visible);
            if (!visible) return;
        
            // Wait briefly for popup to fully load
            await new Promise((res) => setTimeout(res, 250));
        
            const feature = view.popup.features?.[0];
            console.log("✅ Selected popup feature after wait:", feature);
        
            const attributes = feature?.attributes || {};
            const objectId = attributes.objectid?.toString() || attributes.OBJECTID?.toString();
        
            if (!objectId) {
              console.warn("⚠️ No valid objectid found in attributes:", attributes);
              return;
            }
        
            const count = await getLikeCount(objectId);
            const liked = await hasUserLiked(objectId);
        
            console.log(`👍 Like count for objectid ${objectId}: ${count}, liked: ${liked}`);
        
            view.popup.actions.removeAll();
            view.popup.actions.add({
              title: `${count}`,
              id: "like-action",
              className: `esri-icon-thumbs-up ${liked ? "liked" : ""}`
            });
        
            console.log("🆕 Like button injected into popup!");
          }
        );
        view.popup.viewModel.on("trigger-action", async (event) => {
          if (event.action.id !== "like-action") return;

          const feature = view.popup?.selectedFeature;
          if (!feature?.attributes?.objectid) return;

          const objectId = feature.attributes.objectid.toString();
          const updatedCount = await toggleLike(objectId);
          const likeAction = view.popup.actions.find(a => a.id === "like-action");
          if (likeAction) {
            likeAction.title = `${updatedCount}`;
            const likedNow = await hasUserLiked(objectId);
            likeAction.className = `esri-icon-thumbs-up ${likedNow ? "liked" : ""}`;
          }
        });
      });
    });
  });
});
