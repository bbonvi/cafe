import { posts } from "../state";
import { Post } from "./model";
import { handleNewReaction } from "./popup";
import { TRIGGER_REACT_SEL, TRIGGER_REACT_ADD_SEL } from "../vars";
import API from "../api";
import { showAlert } from "../alerts";
import _ from "../lang";

const timer = {
    ref: null,
};

export function init() {
    let currentPost: Post = null as Post;
    const onMouseMove = (e: MouseEvent) => {
        clearTimeout(timer.ref);
        timer.ref = setTimeout(() => {
            handlePostHover(e);
        }, 64);
    }

    function handlePostHover(e: MouseEvent) {
        if (!e.target) {
            return;
        }

        const postEl = (e.target as HTMLElement).closest(".post") as HTMLElement;
        if (!postEl) {
            currentPost = null;
            return;
        }

        const post = posts.get(parseInt(postEl.dataset.id, 10));

        if (post && currentPost !== post) {
            // TODO: Fix not rendering on initial page load
            post.view.renderRecent();
            currentPost = posts.get(parseInt(postEl.dataset.id, 10));
        }
    }

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("click", (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target) {
            return;
        }

        if (target.matches(".post-reacts__showmore")) {
            handleShowMore(target);
            return;
        }

        const newReaction = target.closest(TRIGGER_REACT_ADD_SEL)  as HTMLElement;
        const postEl = target.closest(".post") as HTMLElement;
        if (newReaction && postEl) {
            return handleNewReaction(parseInt(postEl.dataset.id, 10), newReaction);
        }

        const reactElement = target.closest(TRIGGER_REACT_SEL) as HTMLElement;
        if (!reactElement) {
            return;
        }

        const reaction = {
            smileName: reactElement.dataset.smileName,
            postId: parseInt(reactElement.dataset.postId, 10),
        };

        const post = posts.get(parseInt(reactElement.dataset.postId, 10))

        if (isDisabled()) {
            return;
        }

        // Disable button for some time
        disabledButton();

        setTimeout(enableButton, 200);
        API.post.react({
            smileName: reaction.smileName,
            postId: reaction.postId,
        }).then((res) => {
            res.self = !!res.self;
            post.view.setReaction(res);
        }).catch((err) => {
            if (err.message === "Unknown error") {
                showAlert({ message: "You reacting too fast :(", title: _("sendErr"), type: "neutral" });
            } else {
                showAlert({ message: err.message, title: _("sendErr"), type: "warn" });
            }
        });
        function disabledButton() {
            reactElement.setAttribute("disabled", "");
        }
        function enableButton() {
            reactElement.removeAttribute("disabled");
        }
        function isDisabled() {
            return reactElement.hasAttribute("disabled");
        }
    }, { passive: true });
}

function handleShowMore(showMoreEl: HTMLElement) {
    const reactsContainer = showMoreEl.closest(".post-reacts--hidden");
    if (reactsContainer) {
        reactsContainer.classList.remove("post-reacts--hidden");
        showMoreEl.style.display = "none";
    }
}
