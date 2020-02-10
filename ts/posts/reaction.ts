import { posts } from "../state";
import { Post } from "./model";
import { handleNewReaction } from "./popup";
import { TRIGGER_REACT_SEL, TRIGGER_REACT_ADD_SEL } from "../vars";
import API from "../api";

export function init() {
    let currentPost: Post = null as Post;
    document.addEventListener("mousemove", (e: MouseEvent) => {
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
    });

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
        setTimeout(enableButton, 100);

        preemptivelyIncreaseCounter();
        const reactionParams = {
            postId: reaction.postId,
            smileName: reaction.smileName,
        };
        API.post.react({
            smileName: reaction.smileName,
            postId: reaction.postId,
        }).catch(() =>
            post.decrementReaction(reactionParams)
        );

        function disabledButton() {
            reactElement.setAttribute("disabled", "");
        }
        function enableButton() {
            reactElement.removeAttribute("disabled");
        }
        function isDisabled() {
            return reactElement.hasAttribute("disabled");
        }

        function preemptivelyIncreaseCounter() {
            post.setReaction(reaction);
        }
    });
}

function handleShowMore(showMoreEl: HTMLElement) {
    const reactsContainer = showMoreEl.closest(".post-reacts--hidden");
    if (reactsContainer) {
        reactsContainer.classList.remove("post-reacts--hidden");
        showMoreEl.style.display = "none";
    }
}
