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
    const userId = getUserId();

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

    async function getLikeData(objectId) {
      const [summaryDoc, userDoc] = await Promise.all([
        summaryRef.get(),
        db.collection("likes_users").doc(userId).get()
      ]);
      const count = summaryDoc.exists && summaryDoc.data()?.[objectId] || 0;
      const liked = userDoc.exists && userDoc.data()?.[objectId] || false;
      return { count, liked };
    }

    async function toggleLike(objectId) {
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const liked = userDoc.exists && userDoc.data()?.[objectId];

      const updates = {};
      updates[objectId] = liked ? firebase.firestore.FieldValue.delete() : true;

      await userRef.set(updates, { merge: true });

      await summaryRef.set({
        [objectId]: firebase.firestore.FieldValue.increment(liked ? -1 : 1)
      }, { merge: true });

      return await getLikeData(objectId);
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded.");
      window.view = view;

      reactiveUtils.when(() => view.popup.viewModel, () => {
        console.log("🔁 Popup viewModel ready");

        reactiveUtils.watch(() => view.popup.visible, async (visible) => {
          console.log("👁 Popup visibility changed:", visible);
          if (!visible) return;

          const feature = view.popup?.features?.[0];
          if (!feature?.attributes?.objectid) {
            console.warn("⚠️ No valid objectid on feature.");
            return;
          }

          const objectId = feature.attributes.objectid.toString();
          const { count, liked } = await getLikeData(objectId);

          const likeAction = {
            title: `${count}`,
            id: "like-toggle",
            className: "esri-icon-thumbs-up"
          };

          view.popup.actions.removeAll();
          view.popup.actions.add(likeAction);

          // Apply highlight class if already liked
          const node = document.querySelector(".esri-popup__action-button .esri-icon-thumbs-up");
          if (node && liked) {
            node.parentNode.classList.add("liked");
          }
        });

        reactiveUtils.on(() => view.popup.viewModel, "trigger-action", async (event) => {
          if (event.action.id !== "like-toggle") return;

          const feature = view.popup?.features?.[0];
          if (!feature?.attributes?.objectid) return;

          const objectId = feature.attributes.objectid.toString();
          const { count, liked } = await toggleLike(objectId);

          const action = view.popup.actions.find(a => a.id === "like-toggle");
          if (action) action.title = `${count}`;

          const node = document.querySelector(".esri-popup__action-button .esri-icon-thumbs-up");
          if (node?.parentNode) {
            node.parentNode.classList.toggle("liked", liked);
          }

          if (liked) showLikeBurst();
        });
      });
    });
  });
});
