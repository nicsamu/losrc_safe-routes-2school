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

    function showLikeAnimation() {
      const anim = document.createElement("div");
      anim.textContent = "+1";
      anim.style.position = "absolute";
      anim.style.fontSize = "24px";
      anim.style.fontWeight = "bold";
      anim.style.color = "#30737b";
      anim.style.left = "50%";
      anim.style.top = "50%";
      anim.style.transform = "translate(-50%, -50%)";
      anim.style.opacity = "1";
      anim.style.transition = "all 0.8s ease-out";
      document.body.appendChild(anim);

      setTimeout(() => {
        anim.style.top = "30%";
        anim.style.opacity = "0";
      }, 10);

      setTimeout(() => {
        anim.remove();
      }, 1000);
    }

    view.when(() => {
      console.log("🗺️ Web map and view loaded");

      // ✅ Inject Like button into popup when it becomes visible
      view.popup.viewModel.watch("state", (state) => {
        if (state !== "visible") return;

        const graphic = view.popup.selectedFeature;
        if (!graphic || !graphic.attributes) return;

        const hasLikes = "likes" in graphic.attributes;
        const actions = view.popup.actions.toArray();
        const alreadyHasLike = actions.some(action => action.id === "like-action");

        if (hasLikes && !alreadyHasLike) {
          view.popup.actions.add({
            title: "Like",
            id: "like-action",
            className: "esri-icon-thumbs-up"
          });
          console.log("👍 Like action added to popup.");
        }
      });

      // ✅ Handle like button click
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
            graphic.attributes.likes = updatedLikes;

            // 🎉 Animate +1
            showLikeAnimation();

            // 🌀 Update popup content if it's plain HTML
            if (typeof view.popup.content === "string") {
              view.popup.content = view.popup.content.replace(
                /<strong>Likes:<\/strong>\s*\d+/,
                `<strong>Likes:</strong> ${updatedLikes}`
              );
            }
          })
          .catch(err => console.error("❌ Failed to apply edit:", err));
      });
    });
  });
});
