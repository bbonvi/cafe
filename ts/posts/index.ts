// import { isMobile } from './../vars/index';
export { Thread, Post, Backlinks } from "./model";
export { default as PostView } from "./view";
export { getFilePrefix, thumbPath, sourcePath } from "./images";
export { default as PostCollection } from "./collection";
export { isOpen as isHoverActive } from "./hover";

import options from "../options";
import { page, posts } from "../state";
import { copyToClipboard, on } from "../util";
import { RELATIVE_TIME_PERIOD_SECS } from "../vars";
import { POST_FILE_TITLE_SEL } from "../vars";
import { init as initHover } from "./hover";
import { init as initReactionHover } from "./reaction";

import { init as initPopup } from "./popup";
import { init as initReply } from "./reply";

/** Rerender all post timestamps. */
function renderTime() {
    for (const { view } of posts) {
        view.renderTime();
    }
}

function initRenderTime() {
    options.onChange("relativeTime", renderTime);
    setInterval(() => {
        if (options.relativeTime) {
            renderTime();
        }
    }, RELATIVE_TIME_PERIOD_SECS * 1000);
}

function initFileTitle() {
    on(document, "click", (e) => {
        e.preventDefault();
        const title = (e.target as HTMLElement).getAttribute("to-copy");
        copyToClipboard(title);
    }, {selector: POST_FILE_TITLE_SEL});
}

document.addEventListener("readystatechange", onReadyStateChange);
function onReadyStateChange() {
    if (document.readyState === "complete") {
        // TODO: Should we preload blured thumbnails?
        // preloadBlurThumbs();
    }
}
// async function preloadBlurThumbs() {
//     const images = [...document.querySelectorAll(".post-file-thumb_background")] as HTMLElement[];
//     images.reverse();
//     for (let i = 0; i < images.length; i++) {
//         const image = images[i];
//         const src = image.dataset.src;
//         if (src && src.includes("/blur/")) {
//             const preloadLink = document.createElement("link") as any;
//             preloadLink.href = src;
//             preloadLink.rel = "preload";
//             preloadLink.as = "image";
//             // self-destruct
//             preloadLink.onload = () => preloadLink.outerHTML = "";
//             document.head.appendChild(preloadLink);
//         }
//         if (i % 10 === 0) {
//             await new Promise((resolve) => setTimeout(resolve, 2000));
//         }
//     }
// }
let observer: IntersectionObserver = null;
function initIntersectionObserver() {
    const opt = {
        rootMargin: "0px",
        threshold: 0.0,
    };

    observer = new IntersectionObserver(onIntersectionChange, opt);
    const el = [...document.querySelectorAll(".post")] as  HTMLElement[];
    el.forEach((element) => {
        observer.observe(element);
    });
}
interface xHTMLElement extends HTMLElement {
    previousElementSibling: xHTMLElement;
    nextElementSibling: xHTMLElement;
    previousSibling: xHTMLElement;
    nextSibling: xHTMLElement;
}
function onIntersectionChange(
    entries: IntersectionObserverEntry[],
    observ: IntersectionObserver,
) {
    entries.forEach((entry) => {
        requestAnimationFrame(() => {
            const post = entry.target as xHTMLElement;
            setVisibility(post, entry.isIntersecting);
        });
    });
}

function setVisibility(post: HTMLElement, visible: boolean, showOnly?: boolean) {
    // Check if post exists and is a part of a dom
    if (!post || !post.parentElement) {
        return;
    }

    if (visible && !post.dataset.loaded) {
        replaceSrcs(post);
    }

    if (visible && !post.classList.contains("visible")) {
        post.classList.add("visible");
    } else if (!visible && post.classList.contains("visible") && !showOnly) {
        post.classList.remove("visible");
    }
}

export function observePost(post: HTMLElement) {
    observer.observe(post);
}
initIntersectionObserver();


export function replaceSrcs(post: HTMLElement) {
    post.dataset.loaded = "true";
    const containers = [...post.querySelectorAll(".post-file-thumb_containter")];

    containers.forEach((container) => {
        const thumb = container.firstElementChild as HTMLImageElement;
        const blur = thumb.nextElementSibling as HTMLImageElement;
        thumb.src = thumb.dataset.src;
        thumb.title = ""
        thumb.srcset = thumb.dataset.srcset;
        if (thumb) {
            blur.style.backgroundImage = `url("${blur.dataset.src}")`;
        }
    });
}

export function init() {
    if (!page.catalog) {
        initRenderTime();
    }
    initFileTitle();
    initReply();
    initHover();
    initPopup();
    initReactionHover();
}
